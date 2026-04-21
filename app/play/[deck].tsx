import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getDeck } from '@/data/decks/index';
import { ensureAnonymousSession } from '@/lib/auth';
import { getMyCouple, type Couple } from '@/lib/couple';
import {
  clearGameSessionCompletion,
  createOrResumeGameSession,
  loadGameSessionCardAnswers,
  loadMyGameSessionProgress,
  loadSessionCards,
  resetGameSession,
  saveGameSessionAnswer,
  saveGameSessionCompletion,
  updateMyGameSessionProgress,
} from '@/lib/game-session';
import type {
  AnswerBasedValue,
  ChemistryCard,
  CompletionValue,
  GameAnswer,
  GameCard,
  GameSession,
  GameSessionCardAnswers,
  PlayMode,
  Subtheme,
  WouldYouRatherCard,
} from '@/types/game';

const EMPTY_ANSWERS: GameSessionCardAnswers = {
  myAnswer: null,
  partnerAnswer: null,
  myCustomText: null,
  partnerCustomText: null,
  partnerAnswered: false,
};

type CardAnswerState = {
  cardId: string | null;
  answers: GameSessionCardAnswers;
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
  guided_choice: [],
  conversation: [{ id: 'completed', label: "On en a parlé" }],
  dare: [
    { id: 'completed', label: "On l'a fait" },
    { id: 'skipped', label: 'On passe' },
  ],
};

const ANSWER_LABELS: Record<GameAnswer, string> = {
  me: 'Moi',
  you: 'Toi',
  both: 'Les deux',
  option_a: 'Option A',
  option_b: 'Option B',
  option_c: 'Option C',
  option_d: 'Option D',
  other: 'Autre',
  completed: 'Répondu',
  skipped: 'Passé',
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

function isWouldYouRatherCard(card: GameCard): card is WouldYouRatherCard {
  return card.deck === 'would_you_rather_v1';
}

function isChemistryCard(card: GameCard): card is ChemistryCard {
  return card.deck === 'chemistry_v1';
}

function formatScreenError(error: unknown): string {
  if (error && typeof error === 'object') {
    const maybeError = error as { code?: string; message?: string; details?: string };
    const errorText = `${maybeError.message ?? ''} ${maybeError.details ?? ''}`;

    if (
      (maybeError.code === '23514' && errorText.includes('game_session_answers_valid_answer')) ||
      (maybeError.code === '42703' && errorText.includes('custom_text'))
    ) {
      return "Le schéma Supabase du jeu doit être mis à jour pour ce deck.";
    }
  }

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
  const [cardAnswerState, setCardAnswerState] = useState<CardAnswerState>({
    cardId: null,
    answers: EMPTY_ANSWERS,
  });
  const [savingAnswer, setSavingAnswer] = useState<GameAnswer | null>(null);
  const [navigating, setNavigating] = useState<'prev' | 'next' | null>(null);
  const [chemistryOtherOpen, setChemistryOtherOpen] = useState(false);
  const [chemistryCustomText, setChemistryCustomText] = useState('');
  const [sessionComplete, setSessionComplete] = useState(false);

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
        setCardAnswerState({
          cardId: currentCard?.id ?? null,
          answers: currentAnswers,
        });
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
  const cardAnswers = cardAnswerState.cardId === card?.id ? cardAnswerState.answers : EMPTY_ANSWERS;
  const activeDeck = deckDef ?? null;
  const isWouldYouRather =
    !!activeDeck && !!card && activeDeck.playMode === 'would_you_rather' && isWouldYouRatherCard(card);
  const isGuidedChoice =
    !!activeDeck && !!card && activeDeck.playMode === 'guided_choice' && isChemistryCard(card);
  const isConversation = activeDeck?.playMode === 'conversation';
  const isDare = activeDeck?.playMode === 'dare';
  const answerOptions =
    isWouldYouRather && card
      ? [
          { id: 'option_a' as const, label: card.optionA },
          { id: 'option_b' as const, label: card.optionB },
        ]
      : isGuidedChoice && card
        ? [
            { id: 'option_a' as const, label: card.optionA },
            { id: 'option_b' as const, label: card.optionB },
            { id: 'option_c' as const, label: card.optionC },
            ...(card.optionD ? [{ id: 'option_d' as const, label: card.optionD }] : []),
            { id: 'other' as const, label: 'Autre' },
          ]
        : activeDeck
          ? ANSWER_OPTIONS[activeDeck.playMode]
          : [];
  const sessionLength = cards.length;
  const canGoPrev = currentIndex > 0 && !savingAnswer && !navigating;
  const isLastCard = currentIndex === sessionLength - 1;
  const canGoNext = !isLastCard && !!cardAnswers.myAnswer && !savingAnswer && !navigating;
  const canFinish = isLastCard && !!cardAnswers.myAnswer && !savingAnswer && !navigating;
  const nextLabel = isLastCard ? 'Terminer la session →' : 'Carte suivante →';

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
          setCardAnswerState({
            cardId: card.id,
            answers: nextAnswers,
          });
        }
      } catch {
        // Ignore polling errors for V1
      }
    }

    setCardAnswerState((current) =>
      current.cardId === card.id
        ? current
        : {
            cardId: null,
            answers: EMPTY_ANSWERS,
          }
    );
    refreshCardAnswers();
    const timer = setInterval(refreshCardAnswers, 4000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [session?.id, couple?.id, card?.id]);

  useEffect(() => {
    if (!isGuidedChoice) {
      setChemistryOtherOpen(false);
      setChemistryCustomText('');
      return;
    }

    if (cardAnswers.myAnswer === 'other') {
      setChemistryOtherOpen(true);
      setChemistryCustomText(cardAnswers.myCustomText ?? '');
      return;
    }

    setChemistryOtherOpen(false);
    setChemistryCustomText('');
  }, [isGuidedChoice, card?.id, cardAnswers.myAnswer, cardAnswers.myCustomText]);

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

  const resolvedDeck = deckDef;
  const subthemeStyle = SUBTHEME_COLORS[card.subtheme];

  async function refreshCurrentCardAnswers() {
    if (!session || !couple) return;

    const refreshedAnswers = await loadGameSessionCardAnswers(session.id, card.id, couple);
    setCardAnswerState({
      cardId: card.id,
      answers: refreshedAnswers,
    });
  }

  async function handleAnswer(answer: AnswerBasedValue) {
    if (!session || !couple) return;

    setActionError(null);
    setSavingAnswer(answer);

    try {
      await saveGameSessionAnswer(session.id, card.id, answer, null);
      await refreshCurrentCardAnswers();
    } catch (error) {
      setActionError(formatScreenError(error));
    } finally {
      setSavingAnswer(null);
    }
  }

  async function handleCompleteConversationCard() {
    if (!session || !couple) return;

    setActionError(null);
    setSavingAnswer('completed');

    try {
      await saveGameSessionCompletion(session.id, card.id);
      await refreshCurrentCardAnswers();
    } catch (error) {
      setActionError(formatScreenError(error));
    } finally {
      setSavingAnswer(null);
    }
  }

  async function handleDareDecision(decision: CompletionValue) {
    if (!session || !couple || !isDare) return;

    setActionError(null);
    setSavingAnswer(decision);

    try {
      await saveGameSessionCompletion(session.id, card.id, decision);
      await refreshCurrentCardAnswers();
    } catch (error) {
      setActionError(formatScreenError(error));
    } finally {
      setSavingAnswer(null);
    }
  }

  async function handleClearConversationCompletion() {
    if (!session || !couple) return;

    setActionError(null);
    setSavingAnswer('completed');

    try {
      await clearGameSessionCompletion(session.id, card.id);
      await refreshCurrentCardAnswers();
    } catch (error) {
      setActionError(formatScreenError(error));
    } finally {
      setSavingAnswer(null);
    }
  }

  async function handleChemistryOptionPress(answer: AnswerBasedValue) {
    if (!isGuidedChoice) return;

    if (answer === 'other') {
      setActionError(null);
      setChemistryOtherOpen(true);
      if (cardAnswers.myAnswer !== 'other') {
        setChemistryCustomText('');
      }
      return;
    }

    setChemistryOtherOpen(false);
    setChemistryCustomText('');
    await handleAnswer(answer);
  }

  async function handleSaveChemistryOther() {
    if (!session || !couple || !isGuidedChoice) return;

    const nextCustomText = chemistryCustomText.trim();
    if (!nextCustomText) {
      setActionError('Ajoutez une réponse personnelle avant de continuer.');
      return;
    }

    setActionError(null);
    setSavingAnswer('other');

    try {
      await saveGameSessionAnswer(session.id, card.id, 'other', nextCustomText);
      await refreshCurrentCardAnswers();
    } catch (error) {
      setActionError(formatScreenError(error));
    } finally {
      setSavingAnswer(null);
    }
  }

  function getGuidedChoiceLabel(answer: GameAnswer | null, customText: string | null): string {
    if (!isGuidedChoice || !answer) return 'Pas encore de réponse';

    if (answer === 'other') {
      return customText?.trim() || 'Autre';
    }

    const option = answerOptions.find((entry) => entry.id === answer);
    return option?.label ?? ANSWER_LABELS[answer];
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
      setCardAnswerState({
        cardId: null,
        answers: EMPTY_ANSWERS,
      });
    } catch (error) {
      setActionError(formatScreenError(error));
    } finally {
      setNavigating(null);
    }
  }

  function getMyAnswerLabel(): string {
    if (isConversation) {
      return cardAnswers.myAnswer ? 'Terminé' : 'Pas encore fait';
    }
    if (isDare) {
      if (cardAnswers.myAnswer === 'completed') return "On l'a fait";
      if (cardAnswers.myAnswer === 'skipped') return 'On passe';
      return 'Pas encore choisi';
    }
    if (isGuidedChoice) {
      return getGuidedChoiceLabel(cardAnswers.myAnswer, cardAnswers.myCustomText);
    }
    if (!cardAnswers.myAnswer) return 'Pas encore de réponse';
    if (isWouldYouRather) {
      return cardAnswers.myAnswer === 'option_a' ? card.optionA : card.optionB;
    }
    return ANSWER_LABELS[cardAnswers.myAnswer];
  }

  function getPartnerAnswerLabel(): string {
    if (isConversation) {
      return cardAnswers.partnerAnswered && cardAnswers.partnerAnswer ? 'Terminé' : 'En attente';
    }
    if (isDare) {
      if (!cardAnswers.partnerAnswered || !cardAnswers.partnerAnswer) {
        return 'En attente';
      }
      if (cardAnswers.partnerAnswer === 'completed') return "On l'a fait";
      if (cardAnswers.partnerAnswer === 'skipped') return 'On passe';
      return 'En attente';
    }
    if (isGuidedChoice) {
      if (!cardAnswers.partnerAnswered || !cardAnswers.partnerAnswer) {
        return 'En attente de sa réponse';
      }
      return getGuidedChoiceLabel(cardAnswers.partnerAnswer, cardAnswers.partnerCustomText);
    }
    if (!cardAnswers.partnerAnswered || !cardAnswers.partnerAnswer) {
      return 'En attente de sa réponse';
    }
    if (isWouldYouRather) {
      return cardAnswers.partnerAnswer === 'option_a' ? card.optionA : card.optionB;
    }
    return ANSWER_LABELS[cardAnswers.partnerAnswer];
  }

  function handleEndSession() {
    setSessionComplete(true);
  }

  async function handleReplay() {
    if (!session || !couple || !deckDef) return;

    setActionError(null);
    setSessionComplete(false);
    setLoading(true);

    try {
      const newSession = await resetGameSession(session.id, couple.id, deckDef.id);
      const sessionCards = loadSessionCards(newSession);

      setSession(newSession);
      setCards(sessionCards);
      setCurrentIndex(0);
      setCardAnswerState({ cardId: null, answers: EMPTY_ANSWERS });
    } catch (error) {
      setSessionComplete(true);
      setActionError(formatScreenError(error));
    } finally {
      setLoading(false);
    }
  }

  function getCompletionMessage(playMode: PlayMode): string {
    switch (playMode) {
      case 'who_is': return "Vous vous connaissez un peu mieux — c'est déjà beaucoup.";
      case 'would_you_rather': return "Vos choix vous ont révélé l'un à l'autre.";
      case 'conversation': return "Prenez soin de ce qui s'est dit entre vous.";
      case 'guided_choice': return "Vos réponses ont été entendues. La chimie continue.";
      case 'dare': return "Vous avez osé ensemble — c'est ça, être vrais complices.";
    }
  }

  if (sessionComplete && activeDeck) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="dark" />
        <View style={[styles.centered, styles.completionWrap]}>
          <View style={styles.completionCard}>
            <View style={styles.completionIconWrap}>
              <Text style={styles.completionIcon}>♥</Text>
            </View>
            <Text style={styles.completionTitle}>Session terminée</Text>
            <Text style={styles.completionDesc}>{getCompletionMessage(activeDeck.playMode)}</Text>
          </View>
          <View style={styles.completionActions}>
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              onPress={handleReplay}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>Rejouer →</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Retour au couple</Text>
            </Pressable>
          </View>
          {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
        </View>
      </View>
    );
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.deckLabel}>{resolvedDeck.title}</Text>
          <Text style={styles.prompt}>{card.prompt}</Text>
          {isWouldYouRather ? (
            <View style={styles.wyrChoices}>
              {answerOptions.map((option, index) => {
                const isSelected = cardAnswers.myAnswer === option.id;
                const isSavingThisOption = savingAnswer === option.id;

                return (
                  <View key={option.id} style={styles.wyrChoiceBlock}>
                    {index === 1 ? (
                      <View style={styles.wyrDivider}>
                        <Text style={styles.wyrDividerText}>ou</Text>
                      </View>
                    ) : null}
                    <Pressable
                      style={({ pressed }) => [
                        styles.wyrChoiceCard,
                        isSelected && styles.answerBtnSelected,
                        pressed && !savingAnswer && styles.answerBtnPressed,
                        !!savingAnswer && !isSavingThisOption && styles.navBtnDisabled,
                      ]}
                      onPress={() => handleAnswer(option.id as AnswerBasedValue)}
                      disabled={!!savingAnswer}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[
                          styles.wyrChoiceText,
                          isSelected && styles.answerBtnTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>
              {isConversation ? 'Mon avancement' : isDare ? 'Mon statut' : 'Ma réponse'}
            </Text>
            <Text style={styles.statusValue}>{getMyAnswerLabel()}</Text>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>
              {isConversation ? 'Son avancement' : isDare ? 'Son statut' : 'Sa réponse'}
            </Text>
            <Text style={styles.statusValue}>{getPartnerAnswerLabel()}</Text>
          </View>
        </View>

        {isConversation ? (
          <View style={styles.conversationWrap}>
            <Text style={styles.conversationHelper}>Prenez un moment pour en parler à deux.</Text>
            <Pressable
              style={({ pressed }) => [
                styles.answerBtn,
                styles.conversationBtn,
                cardAnswers.myAnswer === 'completed' && styles.answerBtnSelected,
                pressed && !savingAnswer && styles.answerBtnPressed,
              ]}
              onPress={handleCompleteConversationCard}
              disabled={!!savingAnswer}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.answerBtnText,
                  cardAnswers.myAnswer === 'completed' && styles.answerBtnTextSelected,
                ]}
              >
                On en a parlé
              </Text>
            </Pressable>
            {cardAnswers.myAnswer === 'completed' ? (
              <Pressable
                style={({ pressed }) => [
                  styles.secondary,
                  pressed && styles.secondaryPressed,
                  !!savingAnswer && styles.navBtnDisabled,
                ]}
                onPress={handleClearConversationCompletion}
                disabled={!!savingAnswer}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryText}>Marquer comme à reprendre</Text>
              </Pressable>
            ) : null}
          </View>
        ) : isDare ? (
          <View style={styles.conversationWrap}>
            <Text style={styles.conversationHelper}>
              Relevez ce défi seulement si vous en avez envie tous les deux.
            </Text>
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
                    onPress={() => handleDareDecision(option.id as CompletionValue)}
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
          </View>
        ) : isGuidedChoice ? (
          <View style={styles.answersCol}>
            {answerOptions.map((option) => {
              const isSelected = cardAnswers.myAnswer === option.id;
              const isOtherOption = option.id === 'other';

              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    styles.answerBtn,
                    styles.chemistryOptionBtn,
                    isSelected && styles.answerBtnSelected,
                    pressed && !savingAnswer && styles.answerBtnPressed,
                  ]}
                  onPress={() => handleChemistryOptionPress(option.id as AnswerBasedValue)}
                  disabled={!!savingAnswer}
                  accessibilityRole="button"
                >
                  <Text style={[styles.answerBtnText, isSelected && styles.answerBtnTextSelected]}>
                    {option.label}
                  </Text>
                  {isOtherOption ? (
                    <Text
                      style={[
                        styles.chemistryOptionHint,
                        isSelected && styles.chemistryOptionHintSelected,
                      ]}
                    >
                      Réponse libre
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}

            {chemistryOtherOpen ? (
              <View style={styles.otherResponseWrap}>
                <TextInput
                  style={styles.otherResponseInput}
                  value={chemistryCustomText}
                  onChangeText={setChemistryCustomText}
                  placeholder="Explique en détail"
                  placeholderTextColor="#8D99AE"
                  multiline
                  maxLength={280}
                  textAlignVertical="top"
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.cta,
                    (!chemistryCustomText.trim() || !!savingAnswer) && styles.ctaDisabled,
                    pressed &&
                      !!chemistryCustomText.trim() &&
                      !savingAnswer &&
                      styles.ctaPressed,
                  ]}
                  onPress={handleSaveChemistryOther}
                  disabled={!chemistryCustomText.trim() || !!savingAnswer}
                  accessibilityRole="button"
                >
                  <Text style={styles.ctaText}>Enregistrer ma réponse</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : isWouldYouRather ? null : (
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
                  onPress={() => handleAnswer(option.id as AnswerBasedValue)}
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
        )}

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
              (!(isLastCard ? canFinish : canGoNext) || pressed) && styles.ctaPressed,
              !(isLastCard ? canFinish : canGoNext) && styles.ctaDisabled,
            ]}
            onPress={() => (isLastCard ? handleEndSession() : handleMove('next'))}
            disabled={isLastCard ? !canFinish : !canGoNext}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>{nextLabel}</Text>
          </Pressable>
        </View>

        {savingAnswer ? <Text style={styles.helperText}>Enregistrement...</Text> : null}
        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
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
  wyrChoices: {
    width: '100%',
    gap: 10,
  },
  wyrChoiceBlock: {
    gap: 10,
  },
  wyrDivider: {
    alignItems: 'center',
  },
  wyrDividerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C4A882',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  wyrChoiceCard: {
    backgroundColor: '#F9F6F0',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E9D8C8',
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 108,
  },
  wyrChoiceText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2B2D42',
    textAlign: 'center',
    lineHeight: 28,
  },
  chemistryOptionBtn: {
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    gap: 6,
  },
  chemistryOptionHint: {
    fontSize: 13,
    color: '#8D99AE',
    fontWeight: '500',
  },
  chemistryOptionHintSelected: {
    color: '#FFF5EE',
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
  conversationWrap: {
    gap: 10,
  },
  conversationHelper: {
    fontSize: 15,
    color: '#5C677D',
    textAlign: 'center',
    lineHeight: 24,
  },
  conversationBtn: {
    marginTop: 2,
  },
  answersCol: {
    gap: 10,
  },
  otherResponseWrap: {
    gap: 10,
    marginTop: 4,
  },
  otherResponseInput: {
    minHeight: 120,
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E9D8C8',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    lineHeight: 22,
    color: '#2B2D42',
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

  // Completion screen
  completionWrap: {
    flex: 1,
    paddingHorizontal: 8,
    gap: 24,
  },
  completionCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E9D8C8',
    padding: 32,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#C4A882',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 5,
  },
  completionIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F2CCB7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionIcon: {
    fontSize: 32,
    color: '#E07A5F',
  },
  completionTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2B2D42',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  completionDesc: {
    fontSize: 16,
    color: '#5C677D',
    textAlign: 'center',
    lineHeight: 26,
  },
  completionActions: {
    width: '100%',
    gap: 12,
  },
});
