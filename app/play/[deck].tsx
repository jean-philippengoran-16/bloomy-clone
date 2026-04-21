import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getDeck } from '@/data/decks/index';
import { ensureAnonymousSession } from '@/lib/auth';
import { getMyCouple, type Couple } from '@/lib/couple';
import {
  createOrResumeGameSession,
  loadGameSessionCardAnswers,
  loadMyGameSessionProgress,
  loadSessionCards,
  saveGameSessionAnswer,
  updateMyGameSessionProgress,
} from '@/lib/game-session';
import type {
  GameAnswer,
  GameCard,
  GameSession,
  GameSessionCardAnswers,
  PlayMode,
  Subtheme,
} from '@/types/game';

const EMPTY_ANSWERS: GameSessionCardAnswers = {
  myAnswer: null,
  partnerAnswer: null,
  partnerAnswered: false,
};

const ANSWER_OPTIONS: Record<PlayMode, { id: GameAnswer; label: string }[]> = {
  who_is: [
    { id: 'me', label: 'Moi' },
    { id: 'you', label: 'Toi' },
    { id: 'both', label: 'Les deux' },
  ],
  would_you_rather: [
    { id: 'option_a', label: 'Option A' },
    { id: 'option_b', label: 'Option B' },
  ],
};

const ANSWER_LABELS: Record<GameAnswer, string> = {
  me: 'Moi',
  you: 'Toi',
  both: 'Les deux',
  option_a: 'Option A',
  option_b: 'Option B',
};

const SUBTHEME_LABELS: Record<Subtheme, string> = {
  playful: 'Complice',
  romantic: 'Romantique',
  chemistry: 'Chimie',
};

const SUBTHEME_COLORS: Record<Subtheme, { bg: string; text: string }> = {
  playful: { bg: '#F2CCB7', text: '#B85A3A' },
  romantic: { bg: '#FCEADE', text: '#C0533A' },
  chemistry: { bg: '#2B2D42', text: '#FFFDF9' },
};

function formatScreenError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Une erreur est survenue.';
  }

  switch (error.message) {
    case 'couple_not_found':
      return "Votre couple n'a pas été trouvé.";
    case 'session_build_failed':
      return 'Impossible de préparer cette session.';
    case 'session_cards_unavailable':
      return 'Impossible de charger les cartes de cette session.';
    case 'not_authenticated':
      return 'Votre session a expiré. Veuillez réessayer.';
    default:
      return 'Une erreur est survenue.';
  }
}

export default function PlayScreen() {
  const { deck: deckParam } = useLocalSearchParams<{ deck: string }>();
  const deckDef = getDeck(deckParam ?? '');

  const [loading, setLoading] = useState(true);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [cards, setCards] = useState<GameCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardAnswers, setCardAnswers] = useState<GameSessionCardAnswers>(EMPTY_ANSWERS);
  const [savingAnswer, setSavingAnswer] = useState<GameAnswer | null>(null);
  const [navigating, setNavigating] = useState<'prev' | 'next' | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      if (!deckDef) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setScreenError(null);
      setActionError(null);

      try {
        await ensureAnonymousSession();

        const currentCouple = await getMyCouple();
        if (!currentCouple) {
          throw new Error('couple_not_found');
        }

        const sharedSession = await createOrResumeGameSession(currentCouple.id, deckDef.id);
        const sessionCards = loadSessionCards(sharedSession);
        const savedIndex = await loadMyGameSessionProgress(sharedSession.id);
        const safeIndex = Math.max(0, Math.min(savedIndex, sessionCards.length - 1));
        const currentCard = sessionCards[safeIndex];
        const currentAnswers = currentCard
          ? await loadGameSessionCardAnswers(sharedSession.id, currentCard.id, currentCouple)
          : EMPTY_ANSWERS;

        if (cancelled) return;

        setCouple(currentCouple);
        setSession(sharedSession);
        setCards(sessionCards);
        setCurrentIndex(safeIndex);
        setCardAnswers(currentAnswers);
      } catch (error) {
        if (cancelled) return;
        setScreenError(formatScreenError(error));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [deckDef?.id]);

  const card = cards[currentIndex];

  useEffect(() => {
    if (!session || !couple || !card) return;

    const activeSession = session;
    const activeCouple = couple;
    let cancelled = false;

    async function refreshCardAnswers() {
      try {
        const nextAnswers = await loadGameSessionCardAnswers(
          activeSession.id,
          card.id,
          activeCouple
        );
        if (!cancelled) {
          setCardAnswers(nextAnswers);
        }
      } catch {
        // Ignore polling errors for V1
      }
    }

    refreshCardAnswers();
    const timer = setInterval(refreshCardAnswers, 4000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [session?.id, couple?.id, card?.id]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#E07A5F" />
      </View>
    );
  }

  if (!deckDef || screenError || !session || !card) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="dark" />
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>{screenError ?? 'Deck introuvable'}</Text>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Retour</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const answerOptions = ANSWER_OPTIONS[deckDef.playMode];
  const subthemeStyle = SUBTHEME_COLORS[card.subtheme];
  const sessionLength = cards.length;
  const canGoPrev = currentIndex > 0 && !savingAnswer && !navigating;
  const canGoNext =
    currentIndex < sessionLength - 1 && !!cardAnswers.myAnswer && !savingAnswer && !navigating;
  const nextLabel = currentIndex === sessionLength - 1 ? 'Session complète' : 'Carte suivante →';

  async function handleAnswer(answer: GameAnswer) {
    if (!session || !couple) return;

    setActionError(null);
    setSavingAnswer(answer);
    setCardAnswers((current) => ({
      ...current,
      myAnswer: answer,
    }));

    try {
      await saveGameSessionAnswer(session.id, card.id, answer);
      const refreshedAnswers = await loadGameSessionCardAnswers(session.id, card.id, couple);
      setCardAnswers(refreshedAnswers);
    } catch (error) {
      setActionError(formatScreenError(error));
    } finally {
      setSavingAnswer(null);
    }
  }

  async function handleMove(direction: 'prev' | 'next') {
    if (!session) return;

    const nextIndex =
      direction === 'prev'
        ? Math.max(0, currentIndex - 1)
        : Math.min(sessionLength - 1, currentIndex + 1);

    if (nextIndex === currentIndex) return;

    setActionError(null);
    setNavigating(direction);

    try {
      await updateMyGameSessionProgress(session.id, nextIndex);
      setCurrentIndex(nextIndex);
      setCardAnswers(EMPTY_ANSWERS);
    } catch (error) {
      setActionError(formatScreenError(error));
    } finally {
      setNavigating(null);
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.progress}>
          Carte {currentIndex + 1} sur {sessionLength}
        </Text>
        <View style={[styles.subthemeBadge, { backgroundColor: subthemeStyle.bg }]}>
          <Text style={[styles.subthemeText, { color: subthemeStyle.text }]}>
            {SUBTHEME_LABELS[card.subtheme]}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.deckLabel}>{deckDef.title}</Text>
          <Text style={styles.prompt}>{card.prompt}</Text>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Ma réponse</Text>
            <Text style={styles.statusValue}>
              {cardAnswers.myAnswer ? ANSWER_LABELS[cardAnswers.myAnswer] : 'Pas encore répondu'}
            </Text>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Sa réponse</Text>
            <Text style={styles.statusValue}>
              {cardAnswers.partnerAnswered && cardAnswers.partnerAnswer
                ? ANSWER_LABELS[cardAnswers.partnerAnswer]
                : 'En attente de sa réponse'}
            </Text>
          </View>
        </View>

        <View style={styles.answersCol}>
          {answerOptions.map((option) => {
            const isSelected = cardAnswers.myAnswer === option.id;

            return (
              <Pressable
                key={option.id}
                style={({ pressed }) => [
                  styles.answerBtn,
                  isSelected && styles.answerBtnSelected,
                  pressed && !savingAnswer && styles.answerBtnPressed,
                ]}
                onPress={() => handleAnswer(option.id)}
                disabled={!!savingAnswer}
                accessibilityRole="button"
              >
                <Text style={[styles.answerBtnText, isSelected && styles.answerBtnTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.navRow}>
          <Pressable
            style={({ pressed }) => [
              styles.secondary,
              styles.navBtn,
              (!canGoPrev || pressed) && styles.secondaryPressed,
              !canGoPrev && styles.navBtnDisabled,
            ]}
            onPress={() => handleMove('prev')}
            disabled={!canGoPrev}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>← Précédente</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.cta,
              styles.navBtn,
              (!canGoNext || pressed) && styles.ctaPressed,
              !canGoNext && styles.ctaDisabled,
            ]}
            onPress={() => handleMove('next')}
            disabled={!canGoNext}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>{nextLabel}</Text>
          </Pressable>
        </View>

        {savingAnswer ? <Text style={styles.helperText}>Enregistrement...</Text> : null}
        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
        {currentIndex === sessionLength - 1 ? (
          <Text style={styles.helperText}>Vous êtes sur la dernière carte de la session.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F9F6F0',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2B2D42',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#B85A3A',
    textAlign: 'center',
    lineHeight: 22,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E9D8C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 16,
    color: '#5C677D',
  },
  progress: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8D99AE',
    letterSpacing: 0.3,
  },
  subthemeBadge: {
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  subthemeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: '#FFFDF9',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E9D8C8',
    padding: 32,
    shadowColor: '#C4A882',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 5,
    gap: 20,
    alignItems: 'center',
  },
  deckLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C4A882',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  prompt: {
    fontSize: 23,
    fontWeight: '700',
    color: '#2B2D42',
    textAlign: 'center',
    lineHeight: 34,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusCard: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9D8C8',
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 6,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8D99AE',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statusValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2B2D42',
    lineHeight: 22,
  },
  answersCol: {
    gap: 10,
  },
  answerBtn: {
    backgroundColor: '#FFFDF9',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E9D8C8',
    paddingVertical: 16,
    alignItems: 'center',
  },
  answerBtnSelected: {
    backgroundColor: '#E07A5F',
    borderColor: '#E07A5F',
  },
  answerBtnPressed: {
    backgroundColor: '#F2CCB7',
    borderColor: '#E07A5F',
  },
  answerBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2D42',
    letterSpacing: 0.2,
  },
  answerBtnTextSelected: {
    color: '#FFFFFF',
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navBtn: {
    flex: 1,
  },
  navBtnDisabled: {
    opacity: 0.45,
  },
  cta: {
    backgroundColor: '#E07A5F',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#E07A5F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaPressed: {
    backgroundColor: '#D46A4C',
    shadowOpacity: 0.15,
    elevation: 2,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E9D8C8',
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryPressed: {
    backgroundColor: '#F2CCB7',
    borderColor: '#E07A5F',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5C677D',
    letterSpacing: 0.2,
  },
  helperText: {
    fontSize: 14,
    color: '#8D99AE',
    textAlign: 'center',
    lineHeight: 22,
  },
});
