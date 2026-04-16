import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { ROLES } from '../../types';
import { C } from '../../utils/theme';
import { LoadingBar } from '../../components/LoadingBar';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const { login, isLoading, error } = useAuthStore();

  const handleLogin = async () => {
    let valid = true;
    if (!email.trim()) { setEmailError('Email is required.'); valid = false; } else setEmailError(null);
    if (!password) { setPasswordError('Password is required.'); valid = false; } else setPasswordError(null);
    if (!valid) return;
    try {
      const user = await login({ email, password });
      if (user.role === ROLES.REPORTER) {
        router.replace('/(tabs)/reports');
      } else {
        router.replace('/(tabs)/dashboard');
      }
    } catch {
      // error handled in store
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LoadingBar visible={isLoading} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Brand */}
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Feather name="map-pin" size={20} color={C.white} />
            </View>
            <Text style={styles.brandName}>FieldWatch</Text>
          </View>

          {/* Heading */}
          <View style={styles.heading}>
            <Text style={styles.title}>Sign in to your account</Text>
            <Text style={styles.subtitle}>
              Enter your credentials to continue.
            </Text>
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Email address</Text>
            <View style={[styles.inputWrap, focused === 'email' && styles.inputWrapFocused, !!emailError && styles.inputWrapError]}>
              <Feather
                name="mail"
                size={15}
                color={emailError ? C.statusRejected : focused === 'email' ? C.primary : C.placeholder}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="you@company.com"
                placeholderTextColor={C.placeholder}
                value={email}
                onChangeText={(v) => { setEmail(v); if (v.trim()) setEmailError(null); }}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
            {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputWrap, focused === 'password' && styles.inputWrapFocused, !!passwordError && styles.inputWrapError]}>
              <Feather
                name="lock"
                size={15}
                color={focused === 'password' ? C.primary : C.placeholder}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={C.placeholder}
                value={password}
                onChangeText={(v) => { setPassword(v); if (v) setPasswordError(null); }}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showPassword}
                autoComplete="current-password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather
                  name={showPassword ? 'eye' : 'eye-off'}
                  size={15}
                  color={C.placeholder}
                />
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={13} color={C.statusRejected} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btn, isLoading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>{isLoading ? 'Signing in…' : 'Sign In'}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <Link href="/(auth)/register" style={styles.footerLink}>
              Create one
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 36,
    shadowColor: C.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },

  // Brand
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 36,
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 17,
    fontWeight: '700',
    color: C.primary,
    letterSpacing: -0.3,
  },

  // Heading
  heading: {
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: C.primary,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: C.textMuted,
    lineHeight: 20,
  },

  // Fields
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: C.labelText,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 13,
    height: 44,
  },
  inputWrapFocused: {
    borderColor: C.primary,
    backgroundColor: C.white,
  },
  inputWrapError: {
    borderColor: C.statusRejected,
  },
  inputIcon: {
    marginRight: 9,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: C.primary,
    height: '100%',
  },
  fieldError: {
    fontSize: 12,
    color: C.statusRejected,
    marginTop: 4,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: C.errorBg,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.errorBorder,
  },
  errorText: {
    fontSize: 13,
    color: C.statusRejected,
    flex: 1,
    lineHeight: 18,
  },

  // Button
  btn: {
    height: 44,
    backgroundColor: C.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    color: C.white,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // Divider
  divider: {
    marginVertical: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.bg,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    fontSize: 13,
    color: C.textMuted,
  },
  footerLink: {
    fontSize: 13,
    color: C.primary,
    fontWeight: '600',
  },
});
