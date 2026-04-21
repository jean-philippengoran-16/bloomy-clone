import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { ensureAnonymousSession } from '@/lib/auth';
import { getMyCouple, type Couple } from '@/lib/couple';
import { getMyLastCheckIn, saveCheckIn, MOODS, type CheckIn, type Mood } from '@/lib/checkin';
import { DECK_ORDER, DECK_REGISTRY } from '@/data/decks/index';
import { loadCoupleActiveSessions } from '@/lib/game-session';
import type { DeckId } from '@/types/game';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatRelative(iso: string): string {
  const diffMins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMins < 1) return "à l'instant";
  if (diffMins < 60) return `il y a ${diffMins} min`;
  const diffH = Math.floor(diffMins / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffH < 48) return 'hier';
  return formatDate(iso);
}

function getGreeting(): string {
  const h = new Date().getHours();
  return h >= 18 || h < 5 ? 'Bonsoir' : 'Bonjour';
}

const DECK_META: Record<DeckId, { accent: string; tagline: string; intensity: 1 | 2 | 3 }> = {
  who_is_v1:           { accent: '#E07A5F', tagline: 'Léger, complice, un peu piquant',    intensity: 1 },
  would_you_rather_v1: { accent: '#5C5F7A', tagline: "Des choix qui révèlent l'âme",       intensity: 2 },
  connection_v1:       { accent: '#C4A882', tagline: 'Écouter, remercier, rêver ensemble', intensity: 2 },
  chemistry_v1:        { accent: '#2B2D42', tagline: 'Désir guidé, vrai et nuancé',        intensity: 3 },
  dare_v1:             { accent: '#B85A3A', tagline: 'Osez vraiment, ensemble',            intensity: 2 },
};

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  active: { backgroundColor: '#E07A5F' },
  inactive: { backgroundColor: '#E9D8C8' },
  activeLight: { backgroundColor: '#F2CCB7' },
  inactiveLight: { backgroundColor: 'rgba(255,255,255,0.2)' },
});

function IntensityDots({ level, light = false }: { level: 1 | 2 | 3; light?: boolean }) {
  return (
    <View style={dotStyles.row}>
      {([1, 2, 3] as const).map((i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            i <= level
              ? light ? dotStyles.activeLight : dotStyles.active
              : light ? dotStyles.inactiveLight : dotStyles.inactive,
          ]}
        />
      ))}
    </View>
  );
}

export default function CoupleScreen() {
  const [couple, setCouple] = useState<Couple | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState<Set<DeckId>>(new Set());
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<CheckIn | null>(null);

  useEffect(() => {
    async function load() {
      try {
        await ensureAnonymousSession();
        const c = await getMyCouple();
        setCouple(c);
        if (c) {
          const last = await getMyLastCheckIn(c.id);
          setLastCheckIn(last);
          const deckIds = await loadCoupleActiveSessions(c.id);
          setActiveSessions(new Set(deckIds));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!couple || !selectedMood) return;
    setSaving(true);
    try {
      await saveCheckIn(couple.id, selectedMood, note);
      const last = await getMyLastCheckIn(couple.id);
      setLastCheckIn(last);
      setDone(true);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSelectedMood(null);
    setNote('');
    setDone(false);
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#E07A5F" />
      </View>
    );
  }

  if (!couple) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <View style={[styles.centered, { flex: 1 }]}>
          <Text style={styles.heroTitle}>Aucun couple trouvé</Text>
          <Text style={styles.subtitle}>
            Il semblerait que vous ne soyez pas encore connecté à un partenaire.
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={() => router.replace('/')}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Retour à l'accueil</Text>
        </Pressable>
      </View>
    );
  }

  const featuredDeck = DECK_REGISTRY[DECK_ORDER[0]];
  const gridDecks = DECK_ORDER.slice(1).map((id) => DECK_REGISTRY[id]);
  const featuredMeta = DECK_META[featuredDeck.id];

  function getDeckActionLabel(deckId: DeckId): string {
    if (activeSessions.has(deckId)) return 'Reprendre';
    if (deckId === 'connection_v1') return 'Ouvrir';
    if (deckId === 'dare_v1') return 'Oser';
    return 'Jouer';
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StatusBar style="dark" />

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>♥  Vous êtes connectés</Text>
          </View>
          <Text style={styles.heroTitle}>{getGreeting()}, vous deux.</Text>
          <Text style={styles.heroSub}>Chaque moment partagé compte.</Text>
        </View>

        {/* Decks */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>JOUER ENSEMBLE</Text>

          {/* Deck principal */}
          <Pressable
            style={({ pressed }) => [styles.featuredCard, pressed && styles.featuredCardPressed]}
            onPress={() => router.push(`/play/${featuredDeck.id}`)}
            accessibilityRole="button"
          >
            <View style={styles.featuredInner}>
              <Text style={styles.featuredEyebrow}>{featuredMeta.tagline}</Text>
              <Text style={styles.featuredTitle}>{featuredDeck.title}</Text>
              <Text style={styles.featuredDesc}>{featuredDeck.description}</Text>
              <IntensityDots level={featuredMeta.intensity} light />
            </View>
            <View style={styles.featuredCta}>
              <Text style={styles.featuredCtaText}>
                {activeSessions.has(featuredDeck.id) ? 'Reprendre la session →' : 'Lancer une session →'}
              </Text>
            </View>
          </Pressable>

          {/* Grille */}
          <View style={styles.deckGrid}>
            {[gridDecks.slice(0, 2), gridDecks.slice(2, 4)].map((row, rowIdx) => (
              <View key={rowIdx} style={styles.deckRow}>
                {row.map((deck) => {
                  const meta = DECK_META[deck.id];
                  return deck.available ? (
                    <Pressable
                      key={deck.id}
                      style={({ pressed }) => [styles.deckTile, pressed && styles.deckTilePressed]}
                      onPress={() => router.push(`/play/${deck.id}`)}
                      accessibilityRole="button"
                    >
                      <View style={[styles.deckStrip, { backgroundColor: meta.accent }]} />
                      <View style={styles.deckTileBody}>
                        <Text style={styles.deckTileTitle}>{deck.title}</Text>
                        <Text style={styles.deckTileTagline} numberOfLines={2}>
                          {meta.tagline}
                        </Text>
                        <View style={styles.deckTileFooter}>
                          <IntensityDots level={meta.intensity} />
                          <Text style={[styles.deckTileAction, { color: meta.accent }]}>
                            {getDeckActionLabel(deck.id)} →
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  ) : (
                    <View key={deck.id} style={[styles.deckTile, styles.deckTileUnavailable]}>
                      <View style={[styles.deckStrip, { backgroundColor: meta.accent, opacity: 0.3 }]} />
                      <View style={styles.deckTileBody}>
                        <Text style={[styles.deckTileTitle, styles.deckTileTitleMuted]}>
                          {deck.title}
                        </Text>
                        <Text style={styles.deckTileTagline} numberOfLines={2}>
                          {meta.tagline}
                        </Text>
                        <View style={styles.soonBadge}>
                          <Text style={styles.soonText}>Bientôt</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {/* Moment du jour */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MOMENT DU JOUR</Text>
          <View style={styles.card}>
            {done ? (
              <View style={styles.doneWrap}>
                <Text style={styles.doneEmoji}>{selectedMood}</Text>
                <Text style={styles.doneTitle}>Check-in enregistré</Text>
                {note.trim() ? (
                  <Text style={styles.doneNote}>"{note.trim()}"</Text>
                ) : null}
                <Pressable onPress={handleReset} accessibilityRole="button">
                  <Text style={styles.resetLink}>Faire un autre check-in</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.cardTitle}>Comment tu te sens aujourd'hui ?</Text>
                <View style={styles.moodRow}>
                  {MOODS.map((m) => (
                    <Pressable
                      key={m}
                      style={[styles.moodBtn, selectedMood === m && styles.moodBtnActive]}
                      onPress={() => setSelectedMood(m)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.moodEmoji}>{m}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Un mot doux… (facultatif)"
                  placeholderTextColor="#8D99AE"
                  multiline
                  maxLength={120}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.cta,
                    (!selectedMood || saving) && styles.ctaDisabled,
                    pressed && !!selectedMood && !saving && styles.ctaPressed,
                  ]}
                  onPress={handleSave}
                  disabled={!selectedMood || saving}
                  accessibilityRole="button"
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.ctaText}>Enregistrer</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Dernier check-in */}
        {lastCheckIn && !done && (
          <View style={styles.lastCard}>
            <Text style={styles.lastLabel}>TON DERNIER CHECK-IN</Text>
            <View style={styles.lastRow}>
              <Text style={styles.lastEmoji}>{lastCheckIn.mood}</Text>
              <View style={styles.lastMeta}>
                {lastCheckIn.note ? (
                  <Text style={styles.lastNote}>"{lastCheckIn.note}"</Text>
                ) : null}
                <Text style={styles.lastDate}>{formatRelative(lastCheckIn.created_at)}</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.footer}>Ensemble depuis {formatDate(couple.created_at)}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#F9F6F0',
  },
  screen: {
    flex: 1,
    backgroundColor: '#F9F6F0',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#F9F6F0',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 48,
    gap: 20,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  subtitle: {
    fontSize: 15,
    color: '#5C677D',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Hero
  hero: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    marginBottom: 4,
  },
  heroPill: {
    backgroundColor: '#F2CCB7',
    borderRadius: 50,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  heroPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B85A3A',
    letterSpacing: 0.4,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#2B2D42',
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 42,
  },
  heroSub: {
    fontSize: 15,
    color: '#8D99AE',
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // Sections
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8D99AE',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Featured deck
  featuredCard: {
    backgroundColor: '#2B2D42',
    borderRadius: 20,
    padding: 24,
    gap: 20,
    shadowColor: '#2B2D42',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 6,
  },
  featuredCardPressed: {
    opacity: 0.92,
  },
  featuredInner: {
    gap: 10,
  },
  featuredEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F2CCB7',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  featuredTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFDF9',
    letterSpacing: 0.2,
    lineHeight: 34,
  },
  featuredDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 22,
  },
  featuredCta: {
    backgroundColor: '#E07A5F',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#E07A5F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  featuredCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Grille des decks
  deckGrid: {
    gap: 10,
  },
  deckRow: {
    flexDirection: 'row',
    gap: 10,
  },
  deckTile: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9D8C8',
    overflow: 'hidden',
  },
  deckTilePressed: {
    backgroundColor: '#FDF5EF',
  },
  deckTileUnavailable: {
    opacity: 0.55,
  },
  deckStrip: {
    height: 4,
    width: '100%',
  },
  deckTileBody: {
    padding: 14,
    gap: 8,
  },
  deckTileTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2B2D42',
    lineHeight: 20,
  },
  deckTileTitleMuted: {
    color: '#8D99AE',
  },
  deckTileTagline: {
    fontSize: 11,
    color: '#8D99AE',
    lineHeight: 16,
  },
  deckTileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  deckTileAction: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  soonBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2CCB7',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  soonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B85A3A',
    letterSpacing: 0.6,
  },

  // Card check-in
  card: {
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9D8C8',
    padding: 24,
    shadowColor: '#C4A882',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
    gap: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2B2D42',
    textAlign: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  moodBtn: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F9F6F0',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moodBtnActive: {
    backgroundColor: '#F2CCB7',
    borderColor: '#E07A5F',
  },
  moodEmoji: {
    fontSize: 28,
  },
  noteInput: {
    backgroundColor: '#F9F6F0',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E9D8C8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#2B2D42',
    minHeight: 60,
    textAlignVertical: 'top',
  },

  // CTA
  cta: {
    backgroundColor: '#E07A5F',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#E07A5F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaPressed: {
    backgroundColor: '#D46A4C',
    shadowOpacity: 0.15,
    elevation: 2,
  },
  ctaDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Done
  doneWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  doneEmoji: {
    fontSize: 48,
  },
  doneTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2B2D42',
  },
  doneNote: {
    fontSize: 14,
    color: '#5C677D',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  resetLink: {
    fontSize: 13,
    color: '#E07A5F',
    fontWeight: '600',
    marginTop: 4,
  },

  // Dernier check-in
  lastCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9D8C8',
    padding: 20,
    gap: 12,
  },
  lastLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8D99AE',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  lastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  lastEmoji: {
    fontSize: 36,
  },
  lastMeta: {
    flex: 1,
    gap: 4,
  },
  lastNote: {
    fontSize: 14,
    color: '#2B2D42',
    fontStyle: 'italic',
  },
  lastDate: {
    fontSize: 12,
    color: '#8D99AE',
  },

  // Footer
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#C4A882',
    letterSpacing: 0.4,
    marginTop: 8,
  },
});
