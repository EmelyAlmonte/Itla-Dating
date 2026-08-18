import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc,
  doc,
  serverTimestamp, 
  query, 
  orderBy,
  where,
  limit 
} from 'firebase/firestore';

// Correo de la administradora con permisos de eliminación actualizado
const ADMIN_EMAIL = "Emelysolano11@gmail.com"; 

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confessions, setConfessions] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [isRegistering, setIsRegistering] = useState(false);

  // Estado para la navegación entre páginas ('home' | 'confessions')
  const [currentScreen, setCurrentScreen] = useState('home');

  // Estados Formulario Autenticación
  const [identifier, setIdentifier] = useState(''); 
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [username, setUsername] = useState('');

  // Estados Formulario Confesión / Mensaje
  const [selectedRecipient, setSelectedRecipient] = useState('NONE');
  const [customRecipient, setCustomRecipient] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [body, setBody] = useState('');

  // Obtener la lista de confesiones publicadas
  const fetchConfessions = async () => {
    try {
      const q = query(collection(db, "confesiones"), orderBy("created_at", "desc"), limit(25));
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setConfessions(docs);
    } catch (error) {
      console.error("Error al obtener publicaciones:", error);
    }
  };

  // Obtener la lista de usuarios registrados para el desplegable de destinatarios
  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "usuarios"));
      const usersList = querySnapshot.docs.map(d => d.data());
      setRegisteredUsers(usersList);
    } catch (error) {
      console.error("Error al obtener usuarios:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const fallbackUser = { 
          uid: currentUser.uid, 
          email: currentUser.email, 
          usuario: currentUser.displayName || currentUser.email.split('@')[0],
          emailVerified: currentUser.emailVerified
        };
        setUser(fallbackUser);

        try {
          const q = query(collection(db, "usuarios"), where("uid", "==", currentUser.uid), limit(1));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            setUser(prev => ({ 
              ...prev, 
              ...querySnapshot.docs[0].data(),
              email: currentUser.email
            }));
          }
        } catch (err) {
          console.error("Error obteniendo datos del usuario:", err);
        }
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });

    fetchConfessions();
    fetchUsers();

    return () => unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();

    if (!identifier.trim() || !password.trim()) {
      alert("Por favor completa los campos requeridos.");
      return;
    }

    if (isRegistering && password !== confirmPassword) {
      alert("Las contraseñas no coinciden. Por favor verifícalas.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, identifier.trim(), password);
        await sendEmailVerification(userCredential.user);

        const newUser = {
          uid: userCredential.user.uid,
          usuario: username.trim() || identifier.split('@')[0],
          nombre: nombre.trim() || 'Usuario',
          apellido: apellido.trim() || '',
          email: identifier.trim()
        };

        await addDoc(collection(db, "usuarios"), newUser);
        setUser(newUser);
        await fetchUsers();
        alert("¡Cuenta creada con éxito! Se ha enviado un correo de verificación a tu bandeja de entrada.");
      } else {
        let loginEmail = identifier.trim();

        if (!loginEmail.includes('@')) {
          const q = query(collection(db, "usuarios"), where("usuario", "==", loginEmail), limit(1));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            loginEmail = querySnapshot.docs[0].data().email;
          } else {
            alert("El nombre de usuario no existe.");
            setIsSubmitting(false);
            return;
          }
        }

        await signInWithEmailAndPassword(auth, loginEmail, password);
      }

      setIdentifier('');
      setPassword('');
      setConfirmPassword('');
      setUsername('');
      setNombre('');
      setApellido('');
    } catch (error) {
      console.error("Error de autenticación:", error);
      if (error.code === 'auth/invalid-email') {
        alert("El formato del correo electrónico no es válido.");
      } else if (error.code === 'auth/email-already-in-use') {
        alert("El correo electrónico ya se encuentra registrado.");
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        alert("Usuario o contraseña incorrectos.");
      } else {
        alert("Error de autenticación: " + error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    let emailToReset = identifier.trim();

    if (!emailToReset) {
      alert("Ingresa tu correo o usuario en el campo superior para enviarte el enlace de recuperación.");
      return;
    }

    try {
      if (!emailToReset.includes('@')) {
        const q = query(collection(db, "usuarios"), where("usuario", "==", emailToReset), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          emailToReset = querySnapshot.docs[0].data().email;
        } else {
          alert("El nombre de usuario no existe.");
          return;
        }
      }

      await sendPasswordResetEmail(auth, emailToReset);
      alert(`Se ha enviado un correo de recuperación a ${emailToReset}. Revisa tu bandeja de entrada.`);
    } catch (error) {
      console.error("Error al restablecer la contraseña:", error);
      alert("Error: " + error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const handleCreateConfession = async (e) => {
    e.preventDefault();

    if (!body.trim()) {
      alert("Por favor escribe el contenido de tu mensaje.");
      return;
    }

    if (!auth.currentUser) {
      alert("Debes iniciar sesión para publicar.");
      return;
    }

    let finalRecipient = "Todos";
    if (selectedRecipient === 'OTRO') {
      finalRecipient = customRecipient.trim() !== '' ? customRecipient.trim() : "Persona especial";
    } else if (selectedRecipient !== 'NONE' && selectedRecipient !== '') {
      finalRecipient = selectedRecipient;
    }

    try {
      const autorNombre = isAnonymous 
        ? "Anónimo" 
        : (user?.usuario || user?.nombre || auth.currentUser.displayName || "Usuario");

      await addDoc(collection(db, "confesiones"), {
        cuerpo: body.trim(),
        destinatario: finalRecipient,
        esAnonimo: isAnonymous,
        autor: autorNombre,
        autorEmail: auth.currentUser.email || '',
        created_at: serverTimestamp()
      });

      setBody('');
      setSelectedRecipient('NONE');
      setCustomRecipient('');
      setIsAnonymous(false);
      await fetchConfessions();
      alert("¡Confesión publicada con éxito! 💌");
      setCurrentScreen('confessions');
    } catch (error) {
      console.error("Error al guardar en Firestore:", error);
      alert("Error al publicar la confesión: " + error.message);
    }
  };

  const handleDeleteConfession = async (id) => {
    const confirmDelete = window.confirm("¿Estás segura de que deseas eliminar esta confesión?");
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "confesiones", id));
      await fetchConfessions();
      alert("Mensaje eliminado correctamente. 🗑️");
    } catch (error) {
      console.error("Error al eliminar la confesión:", error);
      alert("Error al eliminar: " + error.message);
    }
  };

  const currentEmail = auth.currentUser?.email || user?.email || "";
  const isAdmin = currentEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const visibleConfessions = confessions.filter(c => {
    if (user) return true; 
    return c.esAnonimo === true; 
  });

  if (loadingAuth) {
    return (
      <div style={styles.loadingScreen}>
        <p>Cargando... 💖</p>
      </div>
    );
  }

  return (
    <div style={styles.background}>
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,800;1,400&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');`}
      </style>



      <div style={styles.container}>
       <header style={styles.header}>
       <img 
  src="/Imagenes/Logo itla-Dating.png" 
  alt="ITLA Dating Logo" 
  style={{ 
    position: 'absolute',
    top: '-15px',
    left: '-15px',
    width: '100px', 
    height: '100px', 
    objectFit: 'contain' 
  }}
/>
          <div style={styles.heartBadge}>✨ Muro de Cartas & Confesiones ✨</div>
          <h1 style={styles.title}>ITLA Dating</h1>
          <p style={styles.subtitle}>Comparte secretos, confesiones y cartas especiales</p>
          
          <nav style={styles.navBar}>
            <button 
              onClick={() => setCurrentScreen('home')} 
              style={{
                ...styles.navBtn,
                ...(currentScreen === 'home' ? styles.activeNavBtn : {})
              }}
            >
              🏠 Inicio / Formulario
            </button>
            <button 
              onClick={() => setCurrentScreen('confessions')} 
              style={{
                ...styles.navBtn,
                ...(currentScreen === 'confessions' ? styles.activeNavBtn : {})
              }}
            >
              📜 Ver Confesiones ({visibleConfessions.length})
            </button>
          </nav>
        </header>

        {currentScreen === 'home' && (
          <div>
            {!user ? (
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>{isRegistering ? 'Únete a la Comunidad' : 'Iniciar Sesión'}</h2>
                <form onSubmit={handleAuth} style={styles.form} autoComplete="off">
                  {isRegistering ? (
                    <>
                      <input 
                        style={styles.input} 
                        type="text" 
                        placeholder="Nombre de usuario" 
                        value={username} 
                        onChange={e => setUsername(e.target.value)} 
                        autoComplete="off"
                        required 
                      />
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                          style={styles.input} 
                          type="text" 
                          placeholder="Nombre" 
                          value={nombre} 
                          onChange={e => setNombre(e.target.value)} 
                          autoComplete="off"
                          required 
                        />
                        <input 
                          style={styles.input} 
                          type="text" 
                          placeholder="Apellido" 
                          value={apellido} 
                          onChange={e => setApellido(e.target.value)} 
                          autoComplete="off"
                          required 
                        />
                      </div>
                      <input 
                        style={styles.input} 
                        type="email" 
                        placeholder="Correo electrónico real" 
                        value={identifier} 
                        onChange={e => setIdentifier(e.target.value)} 
                        autoComplete="off"
                        required 
                      />
                    </>
                  ) : (
                    <input 
                      style={styles.input} 
                      type="text" 
                      placeholder="Correo o Nombre de usuario" 
                      value={identifier} 
                      onChange={e => setIdentifier(e.target.value)} 
                      autoComplete="off"
                      required 
                    />
                  )}

                  <div style={styles.passwordContainer}>
                    <input 
                      style={{ ...styles.input, paddingRight: '45px' }} 
                      type={showPassword ? 'text' : 'password'} 
                      placeholder="Contraseña" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      autoComplete="new-password"
                      required 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      style={styles.eyeBtn}
                    >
                      {showPassword ? '👁️' : '🙈'}
                    </button>
                  </div>

                  {isRegistering && (
                    <div style={styles.passwordContainer}>
                      <input 
                        style={{ ...styles.input, paddingRight: '45px' }} 
                        type={showConfirmPassword ? 'text' : 'password'} 
                        placeholder="Confirmar contraseña" 
                        value={confirmPassword} 
                        onChange={e => setConfirmPassword(e.target.value)} 
                        autoComplete="new-password"
                        required 
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                        style={styles.eyeBtn}
                      >
                        {showConfirmPassword ? '👁️' : '🙈'}
                      </button>
                    </div>
                  )}

                  {!isRegistering && (
                    <div style={{ textAlign: 'right', marginTop: '-5px' }}>
                      <button 
                        type="button" 
                        onClick={handleResetPassword} 
                        style={styles.forgotBtn}
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                  )}

                  <button type="submit" style={styles.primaryBtn} disabled={isSubmitting}>
                    {isSubmitting ? 'Procesando...' : (isRegistering ? 'Crear mi Cuenta 💌' : 'Entrar 🌹')}
                  </button>
                </form>
                <button 
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setIdentifier('');
                    setPassword('');
                    setConfirmPassword('');
                    setUsername('');
                    setNombre('');
                    setApellido('');
                  }} 
                  style={styles.switchBtn}
                  disabled={isSubmitting}
                >
                  {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿Aún no tienes cuenta? Regístrate aquí'}
                </button>
              </div>
            ) : (
              <div style={styles.card}>
                <div style={styles.userHeader}>
                  <div>
                    <span style={styles.userGreeting}>
                      Bienvenido/a, <strong style={{ color: '#b71c1c' }}>@{user.usuario || user.nombre}</strong> ✨
                    </span>
                    {isAdmin && <span style={styles.adminBadge}>ADMIN</span>}
                  </div>
                  <button onClick={handleLogout} style={styles.logoutBtn}>Cerrar Sesión</button>
                </div>

                <h3 style={styles.cardTitle}>Escribe una Carta de Amor 💌</h3>
                <form onSubmit={handleCreateConfession} style={styles.form}>
                  
                  <div>
                    <label style={styles.label}>¿A quién va dirigida la carta? (Opcional)</label>
                    <select 
                      value={selectedRecipient} 
                      onChange={e => setSelectedRecipient(e.target.value)}
                      style={styles.input}
                    >
                      <option value="NONE">-- Sin destinatario (Para todos / General) --</option>
                      {registeredUsers.map((u, index) => (
                        <option key={index} value={`${u.nombre || ''} ${u.apellido || ''} (@${u.usuario || ''})`.trim()}>
                          {u.nombre} {u.apellido} (@{u.usuario})
                        </option>
                      ))}
                      <option value="OTRO">Escribir nombre o apodo especial...</option>
                    </select>
                  </div>

                  {selectedRecipient === 'OTRO' && (
                    <input 
                      type="text" 
                      placeholder="Escribe el nombre de la persona..." 
                      value={customRecipient} 
                      onChange={e => setCustomRecipient(e.target.value)} 
                      style={styles.input}
                    />
                  )}

                 <div>
  <label style={styles.label}>¿Publicar en modo anónimo? 🤫</label>
  <div style={styles.radioGroup}>
    <label style={styles.checkboxLabel}>
      <input 
        type="radio" 
        name="anonymous" 
        checked={isAnonymous === true} 
        onChange={() => setIsAnonymous(true)} 
        style={{ accentColor: '#c2185b', width: '16px', height: '16px' }}
      /> 
      Sí
    </label>

    <label style={styles.checkboxLabel}>
      <input 
        type="radio" 
        name="anonymous" 
        checked={isAnonymous === false} 
        onChange={() => setIsAnonymous(false)} 
        style={{ accentColor: '#c2185b', width: '16px', height: '16px' }}
      /> 
      No 
    </label>
  </div>
</div>

                  <textarea 
                    rows="5" 
                    placeholder="Escribe aquí las palabras de tu corazón..." 
                    value={body} 
                    onChange={e => setBody(e.target.value)} 
                    required 
                    style={{ ...styles.input, ...styles.textarea }}
                  />

                  <button type="submit" style={styles.primaryBtn}>
                    Enviar Confesión de Amor 💘
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {currentScreen === 'confessions' && (
          <div>
            <h2 style={styles.feedTitle}>Cartas & Declaraciones 📜</h2>
            
            {!user && (
              <div style={styles.infoBanner}>
                🔒 Estás viendo únicamente las confesiones <strong>Anónimas</strong>. Inicia sesión para ver las publicaciones que no estan en anonimo.
              </div>
            )}

            {visibleConfessions.length === 0 ? (
              <div style={styles.emptyCard}>No hay confesiones disponibles para mostrar en este momento. 💕</div>
            ) : (
              visibleConfessions.map(c => (
                <div key={c.id} style={styles.confessionCard}>
                  <div style={styles.confessionHeader}>
                    <span style={styles.recipientTag}>Para: <strong>{c.destinatario || 'Todos'}</strong></span>
                    {isAdmin && (
                      <button 
                        onClick={() => handleDeleteConfession(c.id)} 
                        style={styles.deleteBtn}
                        title="Eliminar esta confesión"
                      >
                        🗑️ Eliminar
                      </button>
                    )}
                  </div>
                  <p style={styles.confessionText}>“{c.cuerpo}”</p>
                  <div style={styles.confessionFooter}>
                    — Con cariño, <strong style={{ color: '#880e4f' }}>{c.autor || 'Anónimo'}</strong>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  loadingScreen: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#fff5f7',
    color: '#880e4f',
    fontSize: '1.2rem',
    fontFamily: '"Plus Jakarta Sans", sans-serif'
  },
  background: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #fff5f7 0%, #fce4ec 50%, #f8bbd0 100%)',
    padding: '40px 15px',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    color: '#4a1525'
  },
  container: {
    maxWidth: '560px',
    margin: '0 auto'
  },
  header: {
  textAlign: 'center',
  marginBottom: '25px',
  position: 'relative'
},
  heartBadge: {
    display: 'inline-block',
    backgroundColor: '#ffffff',
    color: '#c2185b',
    padding: '6px 16px',
    borderRadius: '25px',
    fontSize: '0.85rem',
    fontWeight: '600',
    marginBottom: '10px',
    boxShadow: '0 4px 12px rgba(194, 24, 91, 0.15)'
  },
  title: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '3rem',
    color: '#880e4f',
    margin: '0 0 8px 0',
    letterSpacing: '-0.5px'
  },
  subtitle: {
    fontFamily: '"Playfair Display", serif',
    fontStyle: 'italic',
    color: '#ad1457',
    fontSize: '1.1rem',
    margin: '0 0 18px 0'
  },
  navBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '15px'
  },
  navBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    color: '#880e4f',
    border: '1px solid #f8bbd0',
    padding: '8px 16px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.9rem',
    transition: 'all 0.2s ease'
  },
  activeNavBtn: {
    backgroundColor: '#c2185b',
    color: '#ffffff',
    borderColor: '#c2185b',
    boxShadow: '0 4px 12px rgba(194, 24, 91, 0.2)'
  },
  infoBanner: {
    backgroundColor: '#fff3e0',
    color: '#e65100',
    border: '1px solid #ffe0b2',
    padding: '12px 16px',
    borderRadius: '12px',
    marginBottom: '20px',
    fontSize: '0.88rem',
    textAlign: 'center'
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    padding: '30px',
    boxShadow: '0 15px 35px rgba(173, 20, 87, 0.12)',
    border: '1px solid rgba(255, 255, 255, 0.8)'
  },
  cardTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '1.6rem',
    color: '#880e4f',
    margin: '0 0 20px 0',
    textAlign: 'center'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#880e4f',
    marginBottom: '6px',
    display: 'block'
  },
  input: {
    width: '100%',
    padding: '13px 15px',
    borderRadius: '12px',
    border: '1.5px solid #f8bbd0',
    backgroundColor: '#fffcfd',
    fontSize: '0.95rem',
    color: '#4a1525',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border 0.3s ease'
  },
  passwordContainer: {
    position: 'relative',
    width: '100%'
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.1rem',
    padding: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  forgotBtn: {
    background: 'none',
    border: 'none',
    color: '#ad1457',
    fontSize: '0.85rem',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '0'
  },
  textarea: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '1.05rem',
    fontStyle: 'italic',
    resize: 'vertical'
  },
  primaryBtn: {
    background: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)',
    color: '#ffffff',
    border: 'none',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '1.05rem',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '10px',
    boxShadow: '0 6px 20px rgba(233, 30, 99, 0.3)'
  },
  switchBtn: {
    background: 'none',
    border: 'none',
    color: '#ad1457',
    marginTop: '18px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    width: '100%',
    textAlign: 'center',
    textDecoration: 'underline'
  },
  userHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '1px solid #f8bbd0'
  },
  userGreeting: {
    fontSize: '1rem'
  },
  adminBadge: {
    marginLeft: '8px',
    backgroundColor: '#b71c1c',
    color: '#ffffff',
    fontSize: '0.7rem',
    fontWeight: 'bold',
    padding: '2px 8px',
    borderRadius: '10px'
  },
  logoutBtn: {
    backgroundColor: '#f8bbd0',
    color: '#880e4f',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  radioGroup: {
    display: 'flex',
    gap: '20px',
    marginTop: '4px'
  },
  checkboxLabel: {
    fontSize: '0.88rem',
    color: '#6a1b29',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  feedTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '1.8rem',
    color: '#880e4f',
    marginBottom: '20px',
    textAlign: 'center'
  },
  confessionCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '22px',
    marginBottom: '18px',
    border: '1px solid #f8bbd0',
    boxShadow: '0 8px 25px rgba(173, 20, 87, 0.08)'
  },
  confessionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  recipientTag: {
    fontSize: '0.95rem',
    color: '#c2185b'
  },
  deleteBtn: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    border: '1px solid #ffcdd2',
    borderRadius: '8px',
    padding: '5px 12px',
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontWeight: '600'
  },
  confessionText: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '1.15rem',
    color: '#311b92',
    lineHeight: '1.6',
    margin: '12px 0',
    fontStyle: 'italic'
  },
  confessionFooter: {
    fontSize: '0.88rem',
    color: '#880e4f',
    textAlign: 'right',
    marginTop: '10px'
  },
  emptyCard: {
    textAlign: 'center',
    padding: '35px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '16px',
    color: '#ad1457',
    fontFamily: '"Playfair Display", serif',
    fontStyle: 'italic',
    fontSize: '1.1rem',
    border: '1px dashed #f8bbd0'
  }
};