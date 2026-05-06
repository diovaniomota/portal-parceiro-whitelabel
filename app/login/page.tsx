'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabaseClient';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) router.replace('/');
    }).catch(() => {});
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    setLoading(false);

    if (authError) {
      setError(authError.message.includes('Invalid login credentials') ? 'Email ou senha incorretos.' : authError.message);
      return;
    }

    router.replace('/');
  };

  return (
    <main className={styles.container}>
      <div className={styles.loginShell}>
        <section className={styles.card}>
          <div className={styles.header}>
            <div className={styles.brandMark}>
              <img src="/dartsoft-icon-cropped.png" alt="DartSoft Sistemas" />
            </div>
            <h1 className={styles.title}>Bem-vindo</h1>
            <p className={styles.subtitle}>Acesse o Portal do Parceiro</p>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span className={styles.label}>E-mail</span>
              <input
                className={styles.input}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                placeholder="seu@email.com"
                required
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Senha</span>
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </label>

            <button className={styles.submitButton} type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className={styles.accessNote}>Acesso exclusivo para parceiros autorizados.</p>
        </section>

        <footer className={styles.footer}>© 2026 DartSoft Sistemas</footer>
      </div>
    </main>
  );
}
