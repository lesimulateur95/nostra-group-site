/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomInt } from "crypto";
import { NextResponse } from "next/server";

import { getUserRoleKeys } from "@/lib/auth/access";
import { getCasinoSettings } from "@/lib/casino/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Card = { rank: number; suit: "♠" | "♥" | "♦" | "♣" };
type BlackjackState = { roundId: string; wager: number; deck: Card[]; player: Card[]; dealer: Card[] };
type PokerBot = { name: string; cards: Card[]; folded: boolean };
type PokerState = { roundId: string; wager: number; deck: Card[]; player: Card[]; bots: PokerBot[]; board: Card[]; phase: number; pot: number };

const SUITS: Card["suit"][] = ["♠", "♥", "♦", "♣"];
const BOT_NAMES = ["La Marquise", "Vega", "Le Baron"];

function deck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) for (let rank = 2; rank <= 14; rank += 1) cards.push({ rank, suit });
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [cards[index], cards[target]] = [cards[target], cards[index]];
  }
  return cards;
}

function cardValue(card: Card): number { return Math.min(card.rank, 10); }
function blackjackValue(cards: Card[]): number {
  let total = cards.reduce((sum, card) => sum + cardValue(card), 0);
  let aces = cards.filter((card) => card.rank === 14).length;
  while (aces > 0 && total + 10 <= 21) { total += 10; aces -= 1; }
  return total;
}

function combinations<T>(items: T[], count: number): T[][] {
  const result: T[][] = [];
  const visit = (start: number, selected: T[]) => {
    if (selected.length === count) { result.push(selected); return; }
    for (let index = start; index <= items.length - (count - selected.length); index += 1) visit(index + 1, [...selected, items[index]]);
  };
  visit(0, []);
  return result;
}

function fiveCardScore(cards: Card[]): number[] {
  const ranks = cards.map((card) => card.rank).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const unique = [...new Set(ranks)];
  if (unique[0] === 14) unique.push(1);
  let straightHigh = 0;
  for (let index = 0; index <= unique.length - 5; index += 1) {
    if (unique[index] - unique[index + 4] === 4) { straightHigh = unique[index]; break; }
  }
  if (flush && straightHigh) return [8, straightHigh];
  if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
  if (groups[0][1] === 3 && groups[1]?.[1] === 2) return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][1] === 3) return [3, groups[0][0], ...groups.slice(1).map(([rank]) => rank).sort((a,b) => b-a)];
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    const pairs = [groups[0][0], groups[1][0]].sort((a,b) => b-a);
    return [2, ...pairs, groups.find((group) => group[1] === 1)?.[0] ?? 0];
  }
  if (groups[0][1] === 2) return [1, groups[0][0], ...groups.slice(1).map(([rank]) => rank).sort((a,b) => b-a)];
  return [0, ...ranks];
}

function compareScore(a: number[], b: number[]): number {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0);
  }
  return 0;
}

function bestScore(cards: Card[]): number[] {
  return combinations(cards, 5).map(fiveCardScore).sort((a, b) => compareScore(b, a))[0];
}

const HAND_LABELS = ["Carte haute", "Paire", "Deux paires", "Brelan", "Suite", "Couleur", "Full", "Carré", "Quinte flush"];

function publicPoker(state: PokerState, showdown = false) {
  const visibleBoard = state.phase === 0 ? [] : state.phase === 1 ? state.board.slice(0, 3) : state.phase === 2 ? state.board.slice(0, 4) : state.board;
  return {
    phase: ["Préflop", "Flop", "Turn", "River", "Abattage"][state.phase] ?? "Abattage",
    phaseIndex: state.phase,
    wager: state.wager,
    pot: state.pot,
    player: state.player,
    board: visibleBoard,
    bots: state.bots.map((bot) => ({ name: bot.name, folded: bot.folded, cards: showdown && !bot.folded ? bot.cards : [] })),
  };
}

async function walletBalance(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<number> {
  const { data } = await admin.from("casino_wallets").select("balance").eq("user_id", userId).maybeSingle();
  return Number(data?.balance ?? 0);
}

async function settle(admin: ReturnType<typeof createAdminClient>, userId: string, roundId: string, payout: number, result: Record<string, unknown>) {
  const { error } = await (admin as any).rpc("casino_server_settle_v108", { p_user_id: userId, p_round_id: roundId, p_payout: Math.max(0, Math.trunc(payout)), p_result: result });
  if (error) throw error;
}

async function begin(supabase: Awaited<ReturnType<typeof createClient>>, game: string, wager: number): Promise<string> {
  const { data, error } = await (supabase as any).rpc("casino_begin_game_v108", { p_game: game, p_wager: wager });
  if (error || !data) throw new Error(String(error?.message ?? "begin_failed"));
  return String(data);
}

async function saveActive(admin: ReturnType<typeof createAdminClient>, userId: string, game: string, roundId: string, state: unknown) {
  const { error } = await admin.from("casino_active_games").upsert({ user_id: userId, game, round_id: roundId, state, updated_at: new Date().toISOString() }, { onConflict: "user_id,game" });
  if (error) throw error;
}

async function getActive<T>(admin: ReturnType<typeof createAdminClient>, userId: string, game: string): Promise<T | null> {
  const { data } = await admin.from("casino_active_games").select("state").eq("user_id", userId).eq("game", game).maybeSingle();
  return data?.state as T | null;
}

async function clearActive(admin: ReturnType<typeof createAdminClient>, userId: string, game: string) {
  await admin.from("casino_active_games").delete().eq("user_id", userId).eq("game", game);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const [settings, roles] = await Promise.all([getCasinoSettings(), getUserRoleKeys(data.user)]);
  if (!settings.publicEnabled && !roles.includes("manager")) return NextResponse.json({ error: "Le casino est fermé." }, { status: 403 });
  if (!settings.configured) return NextResponse.json({ error: "Exécute le SQL V108 avant de jouer." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const game = String(body.game ?? "");
  const action = String(body.action ?? "play");
  const wager = Math.trunc(Number(body.wager));
  const choice = String(body.choice ?? "").slice(0, 40);

  try {
    await (supabase as any).rpc("casino_recover_stale_rounds_v108");

    if (!["blackjack", "poker"].includes(game)) {
      if (!Number.isFinite(wager) || wager < 1) return NextResponse.json({ error: "Mise invalide." }, { status: 400 });
      const { data: result, error } = await (supabase as any).rpc("casino_play_simple_v108", { p_game: game, p_wager: wager, p_choice: choice });
      if (error) throw new Error(String(error.message));
      return NextResponse.json(result);
    }

    const admin = createAdminClient();
    if (game === "blackjack") {
      if (action === "start") {
        const roundId = await begin(supabase, game, wager);
        const cards = deck();
        const state: BlackjackState = { roundId, wager, deck: cards, player: [cards.pop()!, cards.pop()!], dealer: [cards.pop()!, cards.pop()!] };
        if (blackjackValue(state.player) === 21) {
          while (blackjackValue(state.dealer) < 17) state.dealer.push(state.deck.pop()!);
          const dealerValue = blackjackValue(state.dealer);
          const payout = dealerValue === 21 ? wager : Math.trunc(wager * 2.5);
          await settle(admin, data.user.id, roundId, payout, { result: payout > wager ? "blackjack" : "push", player: state.player, dealer: state.dealer });
          return NextResponse.json({ finished: true, result: payout > wager ? "Blackjack !" : "Égalité", payout, player: state.player, dealer: state.dealer, playerValue: 21, dealerValue, balance: await walletBalance(admin, data.user.id) });
        }
        await saveActive(admin, data.user.id, game, roundId, state);
        return NextResponse.json({ finished: false, player: state.player, dealer: [state.dealer[0]], playerValue: blackjackValue(state.player), dealerValue: cardValue(state.dealer[0]), balance: await walletBalance(admin, data.user.id) });
      }

      const state = await getActive<BlackjackState>(admin, data.user.id, game);
      if (!state) return NextResponse.json({ error: "Aucune partie active." }, { status: 409 });
      if (action === "hit") state.player.push(state.deck.pop()!);
      const playerValue = blackjackValue(state.player);
      if (action === "hit" && playerValue < 21) {
        await saveActive(admin, data.user.id, game, state.roundId, state);
        return NextResponse.json({ finished: false, player: state.player, dealer: [state.dealer[0]], playerValue, dealerValue: cardValue(state.dealer[0]), balance: await walletBalance(admin, data.user.id) });
      }
      while (playerValue <= 21 && blackjackValue(state.dealer) < 17) state.dealer.push(state.deck.pop()!);
      const dealerValue = blackjackValue(state.dealer);
      const payout = playerValue > 21 ? 0 : dealerValue > 21 || playerValue > dealerValue ? state.wager * 2 : playerValue === dealerValue ? state.wager : 0;
      const result = playerValue > 21 ? "Dépassé" : dealerValue > 21 ? "Le croupier dépasse" : playerValue > dealerValue ? "Victoire" : playerValue === dealerValue ? "Égalité" : "Le croupier gagne";
      await settle(admin, data.user.id, state.roundId, payout, { result, player: state.player, dealer: state.dealer });
      await clearActive(admin, data.user.id, game);
      return NextResponse.json({ finished: true, result, payout, player: state.player, dealer: state.dealer, playerValue, dealerValue, balance: await walletBalance(admin, data.user.id) });
    }

    if (action === "start") {
      const roundId = await begin(supabase, game, wager);
      const cards = deck();
      const state: PokerState = {
        roundId, wager, deck: cards,
        player: [cards.pop()!, cards.pop()!],
        bots: BOT_NAMES.map((name) => ({ name, cards: [cards.pop()!, cards.pop()!], folded: false })),
        board: [cards.pop()!, cards.pop()!, cards.pop()!, cards.pop()!, cards.pop()!],
        phase: 0,
        pot: wager * 4,
      };
      await saveActive(admin, data.user.id, game, roundId, state);
      return NextResponse.json({ finished: false, poker: publicPoker(state), balance: await walletBalance(admin, data.user.id) });
    }

    const state = await getActive<PokerState>(admin, data.user.id, game);
    if (!state) return NextResponse.json({ error: "Aucune table solo active." }, { status: 409 });
    if (action === "fold") {
      await settle(admin, data.user.id, state.roundId, 0, { result: "fold" });
      await clearActive(admin, data.user.id, game);
      return NextResponse.json({ finished: true, result: "Tu t’es couché", payout: 0, poker: publicPoker(state), balance: await walletBalance(admin, data.user.id) });
    }

    const foldChance = action === "raise" ? 36 : 17;
    state.bots.forEach((bot) => { if (!bot.folded && randomInt(100) < foldChance) bot.folded = true; });
    if (state.bots.every((bot) => bot.folded)) state.bots[randomInt(state.bots.length)].folded = false;
    state.phase += 1;
    if (state.phase < 4) {
      await saveActive(admin, data.user.id, game, state.roundId, state);
      return NextResponse.json({ finished: false, poker: publicPoker(state), balance: await walletBalance(admin, data.user.id) });
    }

    const playerScore = bestScore([...state.player, ...state.board]);
    const contenders = state.bots.filter((bot) => !bot.folded).map((bot) => ({ bot, score: bestScore([...bot.cards, ...state.board]) }));
    const bestBot = contenders.map((entry) => entry.score).sort((a,b) => compareScore(b,a))[0];
    const comparison = bestBot ? compareScore(playerScore, bestBot) : 1;
    const winners = comparison === 0 ? 1 + contenders.filter((entry) => compareScore(entry.score, playerScore) === 0).length : 1;
    const payout = comparison > 0 ? state.pot : comparison === 0 ? Math.trunc(state.pot / winners) : 0;
    const result = comparison > 0 ? `Victoire · ${HAND_LABELS[playerScore[0]]}` : comparison === 0 ? `Partage · ${HAND_LABELS[playerScore[0]]}` : `${HAND_LABELS[playerScore[0]]} battue`;
    await settle(admin, data.user.id, state.roundId, payout, { result, hand: HAND_LABELS[playerScore[0]], board: state.board });
    await clearActive(admin, data.user.id, game);
    return NextResponse.json({ finished: true, result, payout, poker: publicPoker(state, true), balance: await walletBalance(admin, data.user.id) });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).toLowerCase();
    const friendly = message.includes("insufficient_balance") ? "Solde de jetons insuffisant." : message.includes("active_game_exists") ? "Termine d’abord ta partie active." : "La table n’a pas pu traiter l’action. Réessaie.";
    return NextResponse.json({ error: friendly }, { status: 400 });
  }
}
