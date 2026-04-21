import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ensureAnonymousSession } from '@/lib/auth';

const CODE_REGEX = /^[A-Z]{2}-\d{4}$/;

function formatInput(raw: string): string {
  const clean = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const letters = clean.slice(0, 2).replace(/[^A-Z]/g, '');
  const digits = clean.slice(2).replace(/[^0-9]/g, '').slice(0, 4);
  if (digits.length === 0) return letters;
  return `${letters}-${digits}`;
}

function parseRpcError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? '';
  switch (msg) {
    case 'code_not_found':
      return 'Ce code est introuvable. Vérifie les caractères saisis.';
    case 'code_already_claimed':
      return 'Ce code a déjà été utilisé par quelqu\'un d\'autre.';
    case 'code_expired':
      return 'Ce code a expiré. Demande à ton partenaire d\'en générer un nouveau.';
    case 'code_invalid':
      return 'Ce code n\'est plus valide.';
    case 'cannot_claim_own_code':
      return 'Tu ne peux pas utiliser ton propre code de couple.';
    case 'user_already_in_couple':
      return 'Tu fais déjà partie d\'un couple sur Bloomy Clone.';
    case 'creator_already_in_couple':
      return 'Ce code n\'est plus disponible : son créateur a déjà rejoint un autre couple.';
    default:
      return 'Une erreur est survenue. Vérifie ta connexion et réessaie.';
  }
}

export default function JoinScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChangeText(raw: string) {
    setError('');
    setCode(formatInput(raw));
  }

  async function handleJoin() {
    if (!CODE_REGEX.test(code)) {
      setError('Le code doit être au format AB-1234 (2 lettres + 4 chiffres).');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await ensureAnonymousSession();
      const { data, error: rpcError } = await supabase.rpc('claim_couple_invite', {
        p_code: code,
      });
      if (rpcError) throw rpcError;
      const { couple_id } = data as { couple_id: string };
      router.replace({ pathname: '/couple', params: { coupleId: couple_id } });
    } catch (e) {
      setError(parseRpcError(e));
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>♥  Rejoindre votre partenaire</Text>
        </View>
        <Text style={styles.title}>Entrez votre code</Text>
        <Text style={styles.subtitle}>
          Votre partenaire a déjà généré un code.{'\n'}Saisissez-le ci-dessous pour vous connecter.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.inputLabel}>CODE DE COUPLE</Text>

        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          value={code}
          onChangeText={handleChangeText}
          placeholder="AB-1234"
          placeholderTextColor="#8D99AE"
          autoCapitalize="characters"
          autoCorrect={false}
          keyboardType="default"
          maxLength={7}
          returnKeyType="done"
          onSubmitEditing={handleJoin}
          editable={!loading}
          selectionColor="#E07A5F"
          accessibilityLabel="Champ de saisie du code couple"
        />

        <Text style={styles.formatHint}>Format : 2 lettres + tiret + 4 chiffres</Text>

        {error ? <Text style={styles.errorText}>⚠ {error}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.cta,
            pressed && styles.ctaPressed,
            loading && styles.ctaDisabled,
          ]}
          onPress={handleJoin}
          disabled={loading}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaText}>Rejoindre avec ce code</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={styles.backLink}>← Retour</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F9F6F0',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },

  // En-tête
  header: {
    alignItems: 'center',
    gap: 14,
  },
  badge: {
    backgroundColor: '#F2CCB7',
    borderRadius: 50,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E07A5F',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#2B2D42',
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 44,
  },
  subtitle: {
    fontSize: 15,
    color: '#5C677D',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Card
  card: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9D8C8',
    padding: 28,
    marginVertical: 28,
    shadowColor: '#C4A882',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
    justifyContent: 'center',
    gap: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8D99AE',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F9F6F0',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E9D8C8',
    paddingVertical: 18,
    paddingHorizontal: 20,
    fontSize: 28,
    fontWeight: '700',
    color: '#2B2D42',
    textAlign: 'center',
    letterSpacing: 6,
  },
  inputError: {
    borderColor: '#C8553D',
    backgroundColor: '#FDF4F3',
  },
  formatHint: {
    fontSize: 12,
    color: '#8D99AE',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  errorText: {
    fontSize: 13,
    color: '#C8553D',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
  },

  // Actions
  actions: {
    gap: 12,
  },
  cta: {
    backgroundColor: '#E07A5F',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#E07A5F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaPressed: {
    backgroundColor: '#D46A4C',
    shadowOpacity: 0.15,
    elevation: 2,
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  backLink: {
    textAlign: 'center',
    fontSize: 13,
    color: '#8D99AE',
    paddingVertical: 4,
  },
});
