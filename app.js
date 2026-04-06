/* ============================================================
   GHOST LINK V2 — app.js
   Firebase Auth + Firestore + WebRTC + AI Features
   File.io for ephemeral media uploads
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyBl2RFYMEM_duCTq_XNQ8zT_yfRd8y1D8c",
  authDomain: "talq-ac037.firebaseapp.com",
  projectId: "talq-ac037",
  storageBucket: "talq-ac037.firebasestorage.app",
  messagingSenderId: "529512427470",
  appId: "1:529512427470:web:0c212614b7a1947668859f"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ── GLOBAL STATE ─────────────────────────────────────────
let currentUser = null;
let currentRoom = null;
let activeListeners = [];
let devCreditTaps = 0;
let devCreditTimer = null;
let isAdminMode = false;
let typingTimer = null;
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let callTimer = null;
let callSeconds = 0;
let activeCallRoomId = null;
let callType = 'audio';
let selectedMsgId = null;
let selectedMsgRoomId = null;
let selectedMsgText = '';
let replyToMsg = null;
let msgCount = 0;
let callUnsubscribe = null;
let isMuted = false;
let isCamOff = false;
let appReady = false;

const EMOJIS = ['😀','😂','😍','🥰','😎','🤔','😮','😢','😡','👍','👎','❤️','🔥','💯','🎉','✨','👀','💀','🙏','💪','🚀','⚡','🌙','👻','🎭','💬','🔗','🛡️','🔒','🌐'];
const ADMIN_PASS = 'anoopkumar';
const GROQ_API_KEY = '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'; // Replace with your Groq API key

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// ── UTILS ─────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function genCode(len = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
function formatTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}
function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yd = new Date(now); yd.setDate(now.getDate() - 1);
  if (d.toDateString() === yd.toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}
function timeAgo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'h';
  return Math.floor(diff/86400000) + 'd';
}
function showToast(msg, type = 'info', icon = 'fa-info-circle') {
  const tc = $('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas ${icon}"></i><span>${msg}</span>`;
  tc.appendChild(t);
  setTimeout(() => t.classList.add('toast-out'), 3000);
  setTimeout(() => t.remove(), 3400);
}
function generateUsername() {
  const adj = ['Dark','Ghost','Shadow','Cyber','Stealth','Anon','Void','Neon','Hex','Byte'];
  const noun = ['Phantom','Specter','Cipher','Signal','Glitch','Nexus','Vector','Flux','Nova','Pulse'];
  return adj[Math.floor(Math.random()*adj.length)] + noun[Math.floor(Math.random()*noun.length)] + Math.floor(Math.random()*900+100);
}
function getAvatarLetter(name) { return name ? name[0].toUpperCase() : '?'; }
function getRoomColor(roomId) {
  const colors = [
    ['#7c3aed','#00e5ff'], ['#ff2d78','#7c3aed'], ['#00e5ff','#10b981'],
    ['#f59e0b','#ef4444'], ['#10b981','#00e5ff'], ['#ef4444','#ff2d78']
  ];
  let hash = 0;
  for (const c of (roomId||'')) hash = (hash * 31 + c.charCodeAt(0)) % colors.length;
  return colors[hash];
}
function escapeHTML(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function playMsgSound() {
  try { const s = $('msgSound'); s.currentTime = 0; s.volume = 0.3; s.play().catch(()=>{}); } catch(e) {}
}

// ── SHOW / HIDE ────────────────────────────────────────────
function showScreen(id) {
  ['authScreen','mainApp'].forEach(s => {
    const el = $(s);
    if (el) { el.classList.remove('active','hidden'); el.classList.add('hidden'); }
  });
  const target = $(id);
  if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
}
function showModal(id) { const m = $(id); if(m) m.classList.remove('hidden'); }
function hideModal(id) { const m = $(id); if(m) m.classList.add('hidden'); }

// ── TAB SWITCHING ─────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const s = $(tab + 'Screen');
  if (s) s.classList.add('active');
  const n = document.querySelector(`.nav-item[data-tab="${tab}"]`);
  if (n) n.classList.add('active');
  if (tab !== 'chat') {
    $('chatEmptyState').classList.remove('hidden');
    $('chatView').classList.add('hidden');
  }
}

// ── AUTH ──────────────────────────────────────────────────
function initAuth() {
  auth.onAuthStateChanged(user => {
    if (user) { currentUser = user; onUserReady(); }
    else { showScreen('authScreen'); }
  });

  $('anonLoginBtn').onclick = async () => {
    const btn = $('anonLoginBtn');
    try {
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto"></div>';
      const cred = await auth.signInAnonymously();
      const username = generateUsername();
      await db.collection('users').doc(cred.user.uid).set({
        username, uid: cred.user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp(), isAnonymous: true
      }, {merge: true});
      currentUser = cred.user;
      currentUser.displayName = username;
    } catch(e) { showToast('Login failed: ' + e.message, 'error', 'fa-times-circle'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-ghost"></i> Enter as Ghost'; }
  };

  $('customLoginBtn').onclick = async () => {
    const username = $('customUsername').value.trim() || generateUsername();
    const btn = $('customLoginBtn');
    try {
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto"></div>';
      const cred = await auth.signInAnonymously();
      await db.collection('users').doc(cred.user.uid).set({
        username, uid: cred.user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp(), isAnonymous: true
      }, {merge: true});
      currentUser = cred.user;
      currentUser.displayName = username;
      onUserReady();
    } catch(e) { showToast('Login failed: ' + e.message, 'error', 'fa-times-circle'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-mask"></i> Enter with Alias'; }
  };

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $((tab.dataset.tab === 'anon' ? 'anon' : 'custom') + 'Pane').classList.add('active');
    };
  });
}

async function onUserReady() {
  if (appReady) return;
  appReady = true;
  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      currentUser.displayName = data.username || currentUser.displayName;
    }
  } catch(e) {}

  showScreen('mainApp');
  updateProfileUI();
  setupNavigation();
  setupBottomNav();
  setupRoomActions();
  setupChatInput();
  setupEmojiPicker();
  setupContextMenu();
  setupCallUI();
  setupDevCredit();
  setupInstagramBtn();
  setupModalClose();
  setupNotifBtn();
  setupPWA();
  loadUserRooms();
  checkUrlRoom();
  listenForIncomingCalls();

  db.collection('users').doc(currentUser.uid).set(
    { online: true, lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, {merge: true}
  );
  window.addEventListener('beforeunload', () => {
    db.collection('users').doc(currentUser.uid).set({ online: false, lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, {merge: true});
  });
}

function updateProfileUI() {
  const name = currentUser.displayName || 'Ghost';
  const letter = getAvatarLetter(name);
  $('userAvatarTop').textContent = letter;
  $('profileAvatarLg').textContent = letter;
  $('profileUsername').textContent = name;
}

// ── NAVIGATION ────────────────────────────────────────────
function setupNavigation() { $('backToRooms').onclick = () => switchTab('rooms'); }
function setupBottomNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
}

// ── PWA ───────────────────────────────────────────────────
function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ── NOTIFICATIONS ─────────────────────────────────────────
function setupNotifBtn() {
  $('notifBtn').onclick = async () => {
    if (!('Notification' in window)) { showToast('Notifications not supported', 'warning', 'fa-bell-slash'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      showToast('Notifications enabled! 🔔', 'success', 'fa-bell');
      $('notifBtn').style.color = 'var(--accent)';
    } else {
      showToast('Notifications blocked', 'warning', 'fa-bell-slash');
    }
  };
}
function sendBrowserNotif(title, body) {
  if (Notification.permission === 'granted' && document.hidden) {
    new Notification(title, { body, icon: '/icon-192.png' });
  }
}

// ── ROOM ACTIONS ──────────────────────────────────────────
function setupRoomActions() {
  $('createRoomBtn').onclick = () => showModal('createRoomModal');
  $('joinRoomBtn').onclick = () => showModal('joinRoomModal');
  $('confirmCreateRoom').onclick = createRoom;
  $('confirmJoinRoom').onclick = joinRoomByCode;

  // Room Info
  $('roomInfoBtn').onclick = async () => {
    if (!currentRoom) return;
    $('riName').textContent = currentRoom.name;
    $('riCode').textContent = currentRoom.code;
    const link = `${location.origin}${location.pathname}?room=${currentRoom.code}`;
    $('riLink').textContent = link;
    // Show delete if owner
    try {
      const rdoc = await db.collection('rooms').doc(currentRoom.id).get();
      if (rdoc.exists && rdoc.data().createdBy === currentUser.uid) {
        $('deleteRoomBtn').classList.remove('hidden');
      } else {
        $('deleteRoomBtn').classList.add('hidden');
      }
    } catch(e) { $('deleteRoomBtn').classList.add('hidden'); }
    showModal('roomInfoModal');
  };

  $('copyInviteBtn').onclick = () => {
    const link = `${location.origin}${location.pathname}?room=${currentRoom.code}`;
    navigator.clipboard.writeText(link).then(() => showToast('Invite link copied!', 'success', 'fa-check'));
    hideModal('roomInfoModal');
  };

  $('leaveRoomBtn').onclick = async () => {
    if (!currentRoom) return;
    try {
      await db.collection('userRooms').doc(`${currentUser.uid}_${currentRoom.id}`).delete();
      // Update members
      await db.collection('rooms').doc(currentRoom.id).update({
        members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
      }).catch(()=>{});
      showToast('Left room', 'success', 'fa-check');
      hideModal('roomInfoModal');
      currentRoom = null;
      $('chatView').classList.add('hidden');
      $('chatEmptyState').classList.remove('hidden');
      switchTab('rooms');
      loadUserRooms();
    } catch(e) { showToast('Error leaving room', 'error', 'fa-times-circle'); }
  };

  $('deleteRoomBtn').onclick = async () => {
    if (!currentRoom) return;
    if (!confirm(`Delete room "${currentRoom.name}"? This cannot be undone.`)) return;
    hideModal('roomInfoModal');
    await deleteRoomFull(currentRoom.id, currentRoom.name);
  };

  $('aiSummaryBtn').onclick = () => {
    hideModal('roomInfoModal');
    showAISummary();
  };

  $('copyUidBtn').onclick = () => {
    navigator.clipboard.writeText(currentUser.uid).then(() => showToast('Ghost ID copied!', 'success', 'fa-check'));
  };

  $('logoutBtn').onclick = async () => {
    await db.collection('users').doc(currentUser.uid).set({ online: false }, {merge: true});
    activeListeners.forEach(u => { try { u(); } catch(e){} });
    activeListeners = [];
    appReady = false;
    auth.signOut();
    currentRoom = null;
    currentUser = null;
  };

  // Change Nickname
  $('changeNicknameBtn').onclick = () => {
    $('newNicknameInput').value = currentUser.displayName || '';
    showModal('nicknameModal');
  };
  $('confirmNicknameBtn').onclick = async () => {
    const newName = $('newNicknameInput').value.trim();
    if (!newName) return;
    try {
      await db.collection('users').doc(currentUser.uid).update({ username: newName });
      currentUser.displayName = newName;
      updateProfileUI();
      hideModal('nicknameModal');
      showToast('Nickname updated!', 'success', 'fa-check');
    } catch(e) { showToast('Error: ' + e.message, 'error', 'fa-times'); }
  };
  $('newNicknameInput').addEventListener('keydown', e => { if(e.key==='Enter') $('confirmNicknameBtn').click(); });
}

// ── DELETE ROOM (full cleanup) ────────────────────────────
async function deleteRoomFull(roomId, roomName) {
  try {
    showToast('Deleting room...', 'info', 'fa-spinner');
    // Delete messages
    const msgs = await db.collection('rooms').doc(roomId).collection('messages').get();
    if (msgs.size > 0) {
      const batch = db.batch();
      msgs.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    // Delete room
    await db.collection('rooms').doc(roomId).delete();
    // Delete all userRooms mappings
    const userRooms = await db.collection('userRooms').where('roomId','==',roomId).get();
    if (userRooms.size > 0) {
      const batch2 = db.batch();
      userRooms.docs.forEach(d => batch2.delete(d.ref));
      await batch2.commit();
    }
    showToast(`Room "${roomName}" deleted 💀`, 'success', 'fa-skull');
    if (currentRoom && currentRoom.id === roomId) {
      currentRoom = null;
      $('chatView').classList.add('hidden');
      $('chatEmptyState').classList.remove('hidden');
      switchTab('rooms');
    }
    loadUserRooms();
  } catch(e) { showToast('Error deleting: ' + e.message, 'error', 'fa-times'); }
}

// ── CREATE ROOM ───────────────────────────────────────────
async function createRoom() {
  const name = $('roomNameInput').value.trim();
  if (!name) { showToast('Enter a room name', 'warning', 'fa-exclamation'); return; }
  const autoDelete = $('autoDeleteToggle').checked;
  const vanishRoom = $('vanishRoomToggle').checked;
  const passcode = $('roomPasscodeInput').value.trim();
  const code = genCode();
  try {
    $('confirmCreateRoom').disabled = true;
    const roomRef = await db.collection('rooms').add({
      name, code,
      createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      autoDelete, vanishRoom,
      passcode: passcode || null,
      members: [currentUser.uid]
    });
    await db.collection('userRooms').doc(`${currentUser.uid}_${roomRef.id}`).set({
      userId: currentUser.uid, roomId: roomRef.id, roomName: name, roomCode: code,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    $('roomNameInput').value = '';
    $('roomPasscodeInput').value = '';
    $('autoDeleteToggle').checked = false;
    $('vanishRoomToggle').checked = false;
    hideModal('createRoomModal');
    showToast(`Room "${name}" created! 👻`, 'success', 'fa-check-circle');
    loadUserRooms();
    openRoom(roomRef.id, name, code);
  } catch(e) { showToast('Error creating room: ' + e.message, 'error', 'fa-times-circle'); }
  finally { $('confirmCreateRoom').disabled = false; }
}

// ── JOIN ROOM ─────────────────────────────────────────────
async function joinRoomByCode() {
  const code = $('roomCodeInput').value.trim().toUpperCase();
  if (!code) { showToast('Enter a room code', 'warning', 'fa-exclamation'); return; }
  const enteredPass = $('joinPasscodeInput').value.trim();
  try {
    $('confirmJoinRoom').disabled = true;
    const snap = await db.collection('rooms').where('code', '==', code).limit(1).get();
    if (snap.empty) { showToast('Room not found', 'error', 'fa-times-circle'); return; }
    const roomDoc = snap.docs[0];
    const room = roomDoc.data();
    // Passcode check
    if (room.passcode && room.passcode !== enteredPass) {
      showToast('Wrong passcode!', 'error', 'fa-lock'); return;
    }
    const mappingId = `${currentUser.uid}_${roomDoc.id}`;
    const existing = await db.collection('userRooms').doc(mappingId).get();
    if (!existing.exists) {
      await db.collection('userRooms').doc(mappingId).set({
        userId: currentUser.uid, roomId: roomDoc.id, roomName: room.name, roomCode: room.code,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection('rooms').doc(roomDoc.id).update({
        members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
      });
    }
    $('roomCodeInput').value = '';
    $('joinPasscodeInput').value = '';
    hideModal('joinRoomModal');
    showToast(`Joined "${room.name}"!`, 'success', 'fa-check-circle');
    loadUserRooms();
    openRoom(roomDoc.id, room.name, room.code);
  } catch(e) { showToast('Error joining room: ' + e.message, 'error', 'fa-times-circle'); }
  finally { $('confirmJoinRoom').disabled = false; }
}

function checkUrlRoom() {
  const params = new URLSearchParams(location.search);
  const code = params.get('room');
  if (code) {
    $('roomCodeInput').value = code;
    joinRoomByCode();
    history.replaceState({}, '', location.pathname);
  }
}

// ── LOAD USER ROOMS ───────────────────────────────────────
let roomsUnsubscribe = null;
function loadUserRooms() {
  const list = $('roomsList');
  if (!currentUser) return;
  if (roomsUnsubscribe) { try { roomsUnsubscribe(); } catch(e){} roomsUnsubscribe = null; }

  roomsUnsubscribe = db.collection('userRooms')
    .where('userId', '==', currentUser.uid)
    .onSnapshot(async snap => {
      if (snap.empty) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fas fa-door-open"></i></div><h3>No Rooms Yet</h3><p>Create a room or join one with a code</p></div>`;
        $('profileRoomCount').textContent = '0';
        return;
      }
      $('profileRoomCount').textContent = snap.size;
      const rooms = snap.docs
        .map(d => ({...d.data(), mappingId: d.id}))
        .sort((a, b) => {
          const ta = a.joinedAt?.toMillis?.() || 0;
          const tb = b.joinedAt?.toMillis?.() || 0;
          return tb - ta;
        });
      list.innerHTML = '';
      for (const r of rooms) {
        const item = await buildRoomItem(r);
        list.appendChild(item);
      }
    }, err => {
      list.innerHTML = '<p style="color:var(--text-muted);padding:20px;text-align:center">Error loading rooms</p>';
    });
  activeListeners.push(roomsUnsubscribe);
}

async function buildRoomItem(r) {
  const item = document.createElement('div');
  item.className = 'room-item';
  const [c1, c2] = getRoomColor(r.roomId || r.mappingId);

  let lastMsg = 'No messages yet';
  let lastTime = '';
  let isOwner = false;
  let hasPasscode = false;

  try {
    const lastSnap = await db.collection('rooms').doc(r.roomId).collection('messages')
      .orderBy('createdAt', 'desc').limit(1).get();
    if (!lastSnap.empty) {
      const lm = lastSnap.docs[0].data();
      lastMsg = lm.type === 'text'
        ? (lm.text || '').substring(0, 40)
        : lm.type === 'image' ? '📷 Image'
        : lm.type === 'file' ? '📎 File'
        : lm.type === 'audio' ? '🎵 Audio'
        : '📹 Video';
      lastTime = timeAgo(lm.createdAt);
    }
    const roomDoc = await db.collection('rooms').doc(r.roomId).get();
    if (roomDoc.exists) {
      const rd = roomDoc.data();
      if (rd.createdBy === currentUser.uid) isOwner = true;
      if (rd.passcode) hasPasscode = true;
    }
  } catch(e) {}

  item.innerHTML = `
    <div class="room-avatar" style="background:linear-gradient(135deg,${c1},${c2})">${getAvatarLetter(r.roomName)}</div>
    <div class="room-meta">
      <div class="room-name">${escapeHTML(r.roomName)} ${hasPasscode ? '<i class="fas fa-lock" style="font-size:10px;color:var(--accent);margin-left:4px"></i>' : ''}</div>
      <div class="room-last-msg">${escapeHTML(lastMsg)}</div>
    </div>
    <div class="room-right">
      <div class="room-time">${lastTime}</div>
      ${isOwner ? `<button class="room-del-btn" title="Delete Room"><i class="fas fa-trash"></i></button>` : ''}
    </div>`;

  item.onclick = (e) => {
    if (e.target.closest('.room-del-btn')) return;
    openRoom(r.roomId, r.roomName, r.roomCode);
  };

  const delBtn = item.querySelector('.room-del-btn');
  if (delBtn) {
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete room "${r.roomName}"?`)) return;
      await deleteRoomFull(r.roomId, r.roomName);
    };
  }
  return item;
}

// ── OPEN ROOM / CHAT ──────────────────────────────────────
function openRoom(roomId, roomName, roomCode) {
  currentRoom = { id: roomId, name: roomName, code: roomCode };
  $('chatRoomName').textContent = roomName;
  $('chatRoomMeta').textContent = 'Live';
  $('chatEmptyState').classList.add('hidden');
  $('chatView').classList.remove('hidden');
  switchTab('chat');
  replyToMsg = null;
  $('replyBar').classList.add('hidden');
  loadMessages(roomId);
  listenTyping(roomId);
  listenOnlineCount(roomId);
}

// ── MESSAGES ──────────────────────────────────────────────
let msgUnsubscribe = null;
let lastMsgCount = 0;

function loadMessages(roomId) {
  const area = $('messagesArea');
  area.innerHTML = '<div class="messages-loader"><div class="spinner"></div></div>';
  if (msgUnsubscribe) { msgUnsubscribe(); msgUnsubscribe = null; }
  lastMsgCount = 0;

  const q = db.collection('rooms').doc(roomId).collection('messages').orderBy('createdAt').limitToLast(80);
  msgUnsubscribe = q.onSnapshot(snap => {
    area.innerHTML = '';
    let lastDate = '';
    snap.forEach(doc => {
      const msg = { id: doc.id, ...doc.data() };
      const msgDate = formatDate(msg.createdAt);
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        const divider = document.createElement('div');
        divider.className = 'day-divider'; divider.textContent = msgDate;
        area.appendChild(divider);
      }
      area.appendChild(buildMessageEl(msg, roomId));
      // Auto-delete expired messages
      if (msg.autoDelete && msg.createdAt) {
        const msgTime = msg.createdAt.toDate ? msg.createdAt.toDate().getTime() : msg.createdAt;
        if (Date.now() - msgTime > 86400000) {
          db.collection('rooms').doc(roomId).collection('messages').doc(msg.id).delete().catch(()=>{});
        }
      }
    });
    // Play sound + notif for new messages
    if (snap.size > lastMsgCount && lastMsgCount > 0) {
      const lastDoc = snap.docs[snap.size - 1].data();
      if (lastDoc.senderId !== currentUser.uid) {
        playMsgSound();
        sendBrowserNotif(lastDoc.senderName || 'Ghost', lastDoc.text || '📎 Media');
      }
    }
    lastMsgCount = snap.size;
    area.scrollTop = area.scrollHeight;
    markSeen(roomId, snap.docs);
  });
  activeListeners.push(msgUnsubscribe);
}

function buildMessageEl(msg, roomId) {
  const isOwn = msg.senderId === currentUser.uid;
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap ' + (isOwn ? 'own' : 'other');
  wrap.dataset.msgId = msg.id;

  if (msg.type === 'system') {
    wrap.innerHTML = `<div class="msg-system"><small>${escapeHTML(msg.text)}</small></div>`;
    return wrap;
  }

  let contentHTML = '';

  if (msg.type === 'image') {
    contentHTML = `
      <div class="msg-media-wrap">
        <img class="msg-media-thumb" src="${msg.fileUrl}" alt="Image"
          onerror="this.parentElement.innerHTML='<div class=\\'msg-file-expired\\'>❌ File expired</div>'"
          onclick="openMediaViewer('${msg.fileUrl}','image')">
        <div class="file-warn">⚠️ May expire after view</div>
      </div>`;
  } else if (msg.type === 'audio') {
    contentHTML = `
      <div class="msg-media-wrap">
        <audio class="msg-audio-player" controls src="${msg.fileUrl}"
          onerror="this.parentElement.innerHTML='<span style=color:var(--danger)>❌ Audio expired</span>'"></audio>
        <div class="file-warn">⚠️ May expire after view</div>
      </div>`;
  } else if (msg.type === 'video') {
    contentHTML = `
      <div class="msg-media-wrap">
        <video class="msg-media-thumb" src="${msg.fileUrl}" controls
          onerror="this.parentElement.innerHTML='<span style=color:var(--danger)>❌ Video expired</span>'"></video>
        <div class="file-warn">⚠️ May expire after view</div>
      </div>`;
  } else if (msg.type === 'file') {
    const icons = { pdf:'📄', doc:'📝', docx:'📝', txt:'📃', default:'📎' };
    const ext = (msg.fileName||'').split('.').pop().toLowerCase();
    contentHTML = `
      <div class="msg-file-card" onclick="window.open('${msg.fileUrl}','_blank');showToast('Opening file','warning','fa-exclamation-triangle')">
        <span class="file-icon">${icons[ext]||icons.default}</span>
        <div class="file-info">
          <div class="file-name">${escapeHTML(msg.fileName||'File')}</div>
          <div class="file-warn">⚠️ Expires after opening</div>
        </div>
        <i class="fas fa-external-link-alt" style="color:var(--text-muted);font-size:12px"></i>
      </div>`;
  } else {
    contentHTML = `<span>${escapeHTML(msg.text||'')}</span>`;
  }

  // Reply quote
  let replyHTML = '';
  if (msg.replyTo) {
    replyHTML = `<div class="msg-reply-quote"><i class="fas fa-reply" style="font-size:10px"></i> <span>${escapeHTML((msg.replyTo.text||'').substring(0,50))}</span></div>`;
  }

  const reactions = msg.reactions ? Object.entries(msg.reactions).map(([e,uids]) =>
    `<span class="msg-reaction" data-emoji="${e}" data-msgid="${msg.id}">${e} ${uids.length}</span>`).join('') : '';

  const seenIcon = isOwn ? `<span class="msg-seen"><i class="fas fa-check-double"></i></span>` : '';

  wrap.innerHTML = `
    ${!isOwn ? `<div class="msg-sender">${escapeHTML(msg.senderName||'Ghost')}</div>` : ''}
    <div class="msg-bubble">
      ${replyHTML}
      ${contentHTML}
    </div>
    <div class="msg-footer">
      <span class="msg-time">${formatTime(msg.createdAt)}</span>
      ${seenIcon}
    </div>
    ${reactions ? `<div class="msg-reactions">${reactions}</div>` : ''}`;

  // Context menu
  const bubble = wrap.querySelector('.msg-bubble');
  let pressTimer;
  bubble.addEventListener('contextmenu', e => { e.preventDefault(); showContextMenu(e, msg, roomId, isOwn); });
  bubble.addEventListener('touchstart', () => { pressTimer = setTimeout(() => showContextMenu(null, msg, roomId, isOwn), 600); }, {passive:true});
  bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
  bubble.addEventListener('touchmove', () => clearTimeout(pressTimer));

  // Reaction clicks
  wrap.querySelectorAll('.msg-reaction').forEach(r => {
    r.onclick = () => toggleReaction(roomId, msg.id, r.dataset.emoji);
  });

  return wrap;
}

// ── MEDIA VIEWER ──────────────────────────────────────────
window.openMediaViewer = (url, type) => {
  const overlay = document.createElement('div');
  overlay.className = 'media-viewer-overlay';
  overlay.innerHTML = type === 'image'
    ? `<img src="${url}" style="max-width:95vw;max-height:90vh;border-radius:12px">`
    : `<video src="${url}" controls style="max-width:95vw;max-height:90vh;border-radius:12px"></video>`;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
};

async function markSeen(roomId, docs) {
  const lastDoc = docs[docs.length - 1];
  if (!lastDoc) return;
  const msg = lastDoc.data();
  if (msg.senderId !== currentUser.uid && !msg.seenBy?.includes(currentUser.uid)) {
    db.collection('rooms').doc(roomId).collection('messages').doc(lastDoc.id).update({
      seenBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    }).catch(()=>{});
  }
}

// ── CHAT INPUT ────────────────────────────────────────────
function setupChatInput() {
  const input = $('msgInput');
  $('sendMsgBtn').onclick = sendMessage;
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  input.addEventListener('input', handleTyping);
  $('attachBtn').onclick = () => $('fileInput').click();
  $('fileInput').onchange = handleFileUpload;
  $('cancelReplyBtn').onclick = () => {
    replyToMsg = null;
    $('replyBar').classList.add('hidden');
    input.focus();
  };
}

async function sendMessage() {
  const text = $('msgInput').value.trim();
  if (!text || !currentRoom) return;
  $('msgInput').value = '';
  msgCount++;
  $('profileMsgCount').textContent = msgCount;

  const msgData = {
    text, type: 'text',
    senderId: currentUser.uid,
    senderName: currentUser.displayName || 'Ghost',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    seenBy: [currentUser.uid]
  };
  if (replyToMsg) {
    msgData.replyTo = {
      id: replyToMsg.id,
      text: replyToMsg.text || '',
      senderName: replyToMsg.senderName || 'Ghost'
    };
    replyToMsg = null;
    $('replyBar').classList.add('hidden');
  }

  try {
    await db.collection('rooms').doc(currentRoom.id).collection('messages').add(msgData);
    db.collection('rooms').doc(currentRoom.id).collection('typing').doc(currentUser.uid).delete().catch(()=>{});
  } catch(e) { showToast('Failed to send', 'error', 'fa-times-circle'); $('msgInput').value = text; }
}

function handleTyping() {
  if (!currentRoom) return;
  db.collection('rooms').doc(currentRoom.id).collection('typing').doc(currentUser.uid).set({
    name: currentUser.displayName || 'Ghost', time: Date.now()
  }).catch(()=>{});
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    db.collection('rooms').doc(currentRoom.id).collection('typing').doc(currentUser.uid).delete().catch(()=>{});
  }, 2000);
}

function listenTyping(roomId) {
  const unsubscribe = db.collection('rooms').doc(roomId).collection('typing')
    .onSnapshot(snap => {
      const others = snap.docs.filter(d => d.id !== currentUser.uid && Date.now() - (d.data().time||0) < 3000);
      if (others.length > 0) {
        $('typingIndicator').classList.remove('hidden');
        $('typingText').textContent = others.length === 1
          ? `${others[0].data().name} is typing...`
          : 'Multiple people typing...';
      } else {
        $('typingIndicator').classList.add('hidden');
      }
    });
  activeListeners.push(unsubscribe);
}

function listenOnlineCount(roomId) {
  const unsubscribe = db.collection('rooms').doc(roomId).onSnapshot(async snap => {
    if (!snap.exists) return;
    const members = snap.data().members || [];
    if (!members.length) return;
    try {
      const userSnaps = await db.collection('users').where('uid','in',members.slice(0,10)).where('online','==',true).get();
      $('chatRoomMeta').textContent = userSnaps.size + ' online';
    } catch(e) {}
  });
  activeListeners.push(unsubscribe);
}

// ── FILE UPLOAD (file.io) ─────────────────────────────────
async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file || !currentRoom) return;
  $('fileInput').value = '';

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) { showToast('File must be under 10MB', 'error', 'fa-times-circle'); return; }

  const progress = document.createElement('div');
  progress.className = 'upload-progress glass-card';
  progress.innerHTML = `
    <div class="spinner"></div>
    <div style="flex:1">
      <div style="font-size:13px">Uploading ${file.name.substring(0,25)}...</div>
      <div class="upload-bar"><div class="upload-bar-fill" id="uploadFill"></div></div>
    </div>`;
  document.body.appendChild(progress);

  // Animate bar
  let pct = 0;
  const fillInterval = setInterval(() => {
    pct = Math.min(pct + Math.random() * 12, 90);
    const fill = document.getElementById('uploadFill');
    if (fill) fill.style.width = pct + '%';
  }, 200);

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('https://file.io/?expires=1d', { method: 'POST', body: formData });
    const data = await res.json();

    if (!data.success || !data.link) throw new Error('Upload failed — file.io may be unavailable. Try a smaller file.');

    clearInterval(fillInterval);
    const fill = document.getElementById('uploadFill');
    if (fill) fill.style.width = '100%';

    const fileUrl = data.link;
    const type = file.type.startsWith('image/') ? 'image'
      : file.type.startsWith('audio/') ? 'audio'
      : file.type.startsWith('video/') ? 'video'
      : 'file';

    await db.collection('rooms').doc(currentRoom.id).collection('messages').add({
      type, fileUrl, fileName: file.name, fileSize: file.size,
      senderId: currentUser.uid, senderName: currentUser.displayName || 'Ghost',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      seenBy: [currentUser.uid], ephemeral: true
    });
    showToast('File sent! ⚠️ Expires after first view', 'warning', 'fa-exclamation-triangle');
    msgCount++;
    $('profileMsgCount').textContent = msgCount;
  } catch(err) {
    clearInterval(fillInterval);
    showToast('Upload failed: ' + err.message, 'error', 'fa-times-circle');
  } finally {
    setTimeout(() => progress.remove(), 400);
  }
}

// ── EMOJI PICKER ──────────────────────────────────────────
function setupEmojiPicker() {
  const grid = $('emojiGrid');
  EMOJIS.forEach(e => {
    const span = document.createElement('span');
    span.className = 'emoji-item'; span.textContent = e;
    span.onclick = () => {
      $('msgInput').value += e;
      $('msgInput').focus();
      $('emojiPicker').classList.add('hidden');
    };
    grid.appendChild(span);
  });
  $('emojiBtn').onclick = e => { e.stopPropagation(); $('emojiPicker').classList.toggle('hidden'); };
  document.addEventListener('click', e => {
    if (!$('emojiPicker').contains(e.target) && e.target !== $('emojiBtn')) {
      $('emojiPicker').classList.add('hidden');
    }
  });
}

// ── CONTEXT MENU ──────────────────────────────────────────
function setupContextMenu() {
  document.addEventListener('click', () => {
    $('contextMenu').classList.add('hidden');
    $('reactionPicker').classList.add('hidden');
  });

  $('ctxReply').onclick = () => {
    $('contextMenu').classList.add('hidden');
    if (!selectedMsgId) return;
    replyToMsg = { id: selectedMsgId, text: selectedMsgText, senderName: selectedMsgSender };
    $('replyBarText').textContent = `${selectedMsgSender}: ${(selectedMsgText||'').substring(0,40)}`;
    $('replyBar').classList.remove('hidden');
    $('msgInput').focus();
  };

  $('ctxCopy').onclick = () => {
    if (selectedMsgText) navigator.clipboard.writeText(selectedMsgText).then(() => showToast('Copied!', 'success', 'fa-check'));
    $('contextMenu').classList.add('hidden');
  };

  $('ctxReact').onclick = e => {
    e.stopPropagation();
    $('contextMenu').classList.add('hidden');
    const rp = $('reactionPicker');
    rp.style.cssText = $('contextMenu').style.cssText;
    rp.classList.remove('hidden');
  };

  $('ctxDelete').onclick = async () => {
    if (!selectedMsgId || !selectedMsgRoomId) return;
    $('contextMenu').classList.add('hidden');
    try {
      await db.collection('rooms').doc(selectedMsgRoomId).collection('messages').doc(selectedMsgId).delete();
      showToast('Message deleted', 'success', 'fa-check');
    } catch(e) { showToast('Cannot delete', 'error', 'fa-times'); }
  };

  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.onclick = () => {
      toggleReaction(selectedMsgRoomId, selectedMsgId, btn.dataset.emoji);
      $('reactionPicker').classList.add('hidden');
    };
  });
}

let selectedMsgSender = '';

function showContextMenu(e, msg, roomId, isOwn) {
  selectedMsgId = msg.id;
  selectedMsgRoomId = roomId;
  selectedMsgText = msg.text || '';
  selectedMsgSender = msg.senderName || 'Ghost';
  const menu = $('contextMenu');
  if (isOwn) $('ctxDelete').classList.remove('hidden');
  else $('ctxDelete').classList.add('hidden');
  let x, y;
  if (e) { x = Math.min(e.clientX, window.innerWidth - 160); y = Math.min(e.clientY, window.innerHeight - 150); }
  else { x = window.innerWidth / 2 - 70; y = window.innerHeight / 2; }
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
  menu.classList.remove('hidden');
  $('reactionPicker').style.left = x + 'px';
  $('reactionPicker').style.top = (y - 60) + 'px';
}

async function toggleReaction(roomId, msgId, emoji) {
  if (!roomId || !msgId) return;
  const ref = db.collection('rooms').doc(roomId).collection('messages').doc(msgId);
  try {
    const doc = await ref.get();
    if (!doc.exists) return;
    const reactions = doc.data().reactions || {};
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf(currentUser.uid);
    if (idx > -1) reactions[emoji].splice(idx, 1);
    else reactions[emoji].push(currentUser.uid);
    if (reactions[emoji].length === 0) delete reactions[emoji];
    await ref.update({ reactions });
  } catch(e) {}
}

// ── AI CHAT SUMMARY ───────────────────────────────────────
async function showAISummary() {
  if (!currentRoom) return;
  showModal('aiSummaryModal');
  $('aiSummaryContent').innerHTML = '<div class="ai-loading"><div class="spinner"></div><span>Analyzing chat...</span></div>';

  try {
    const snap = await db.collection('rooms').doc(currentRoom.id).collection('messages')
      .orderBy('createdAt', 'desc').limit(50).get();

    if (snap.empty) {
      $('aiSummaryContent').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">No messages to summarize yet.</p>';
      return;
    }

    const msgs = snap.docs.reverse().map(d => {
      const m = d.data();
      return m.type === 'text' ? `${m.senderName||'Ghost'}: ${m.text}` : `${m.senderName||'Ghost'}: [${m.type}]`;
    }).join('\n');

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: 'You are a chat summarizer. Summarize the following chat conversation briefly in 3-5 bullet points. Be concise and capture key topics discussed.' },
          { role: 'user', content: msgs }
        ],
        max_tokens: 300
      })
    });

    if (!res.ok) throw new Error('AI service unavailable');
    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content || 'Could not generate summary.';

    $('aiSummaryContent').innerHTML = `
      <div class="ai-summary-result">
        <div class="ai-summary-icon"><i class="fas fa-brain"></i></div>
        <div class="ai-summary-text">${summary.replace(/\n/g, '<br>').replace(/•|\*/g, '').replace(/^-\s/gm, '• ')}</div>
        <div class="ai-summary-footer"><i class="fas fa-robot"></i> Powered by Groq AI (Llama 3)</div>
      </div>`;
  } catch(e) {
    $('aiSummaryContent').innerHTML = `<p style="color:var(--danger);text-align:center;padding:20px"><i class="fas fa-exclamation-triangle"></i> AI unavailable. Set your Groq API key in app.js.</p>`;
  }
}

// ── CALL SYSTEM ───────────────────────────────────────────
function setupCallUI() {
  $('startAudioCall').onclick = () => initiateCall('audio');
  $('startVideoCall').onclick = () => initiateCall('video');
  $('endCallBtn').onclick = endCall;
  $('toggleMuteBtn').onclick = toggleMute;
  $('toggleCamBtn').onclick = toggleCamera;
  $('acceptCallBtn').onclick = acceptCall;
  $('rejectCallBtn').onclick = rejectCall;
}

async function initiateCall(type) {
  if (!currentRoom) return;
  callType = type;
  activeCallRoomId = currentRoom.id;
  try {
    const constraints = type === 'video' ? { video: true, audio: true } : { audio: true };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    $('localVideo').srcObject = localStream;
    $('localVideo').style.display = type === 'video' ? 'block' : 'none';
    $('remoteVideo').style.display = type === 'video' ? 'block' : 'none';
    $('callAvatarPlaceholder').style.display = type === 'video' ? 'none' : 'flex';
    showCallOverlay('Calling...');
    await createPeerConnection(activeCallRoomId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await db.collection('calls').doc(activeCallRoomId).set({
      offer: { type: offer.type, sdp: offer.sdp },
      callerId: currentUser.uid, callerName: currentUser.displayName || 'Ghost',
      callType: type, status: 'ringing',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    playRing(true);
    listenCallAnswer(activeCallRoomId);
    // Save to call history
    saveCallHistory(currentRoom.name, type, 'outgoing');
  } catch(e) { showToast('Cannot start call: ' + e.message, 'error', 'fa-times-circle'); hideCallOverlay(); }
}

function saveCallHistory(roomName, callType, direction) {
  const history = JSON.parse(localStorage.getItem('callHistory') || '[]');
  history.unshift({ roomName, callType, direction, time: Date.now() });
  if (history.length > 20) history.pop();
  localStorage.setItem('callHistory', JSON.stringify(history));
  renderCallHistory();
}

function renderCallHistory() {
  const list = $('callHistoryList');
  const history = JSON.parse(localStorage.getItem('callHistory') || '[]');
  if (!history.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fas fa-phone-slash"></i></div><h3>No Recent Calls</h3><p>Start a call from within a chat room</p></div>`;
    return;
  }
  list.innerHTML = history.map(h => `
    <div class="call-history-item glass-card">
      <div class="call-history-icon ${h.direction}">
        <i class="fas fa-${h.callType === 'video' ? 'video' : 'phone'}"></i>
      </div>
      <div class="call-history-info">
        <div class="call-history-name">${escapeHTML(h.roomName)}</div>
        <div class="call-history-meta">
          <i class="fas fa-arrow-${h.direction === 'outgoing' ? 'up' : 'down'}-left"></i>
          ${h.direction} · ${timeAgo({toDate: () => new Date(h.time)})}
        </div>
      </div>
      <div class="call-history-type"><i class="fas fa-${h.callType === 'video' ? 'video' : 'phone'}"></i></div>
    </div>`).join('');
}

function listenForIncomingCalls() {
  if (callUnsubscribe) callUnsubscribe();
  callUnsubscribe = db.collection('calls')
    .where('status', '==', 'ringing')
    .onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          const call = change.doc.data();
          if (call.callerId === currentUser.uid) return;
          showIncomingCall(change.doc.id, call);
        }
        if (change.type === 'removed') {
          $('incomingCall').classList.add('hidden');
          stopRing();
        }
      });
    });
  activeListeners.push(callUnsubscribe);
}

function showIncomingCall(roomId, call) {
  $('incomingCallerName').textContent = call.callerName || 'Ghost';
  $('incomingCallType').textContent = call.callType === 'video' ? '📹 Video Call' : '📞 Audio Call';
  $('incomingCall').classList.remove('hidden');
  playRing(false);
  $('acceptCallBtn').onclick = () => acceptCallWithId(roomId, call);
  $('rejectCallBtn').onclick = () => rejectCallWithId(roomId);
  saveCallHistory(call.callerName || 'Ghost', call.callType || 'audio', 'incoming');
}

async function acceptCallWithId(roomId, call) {
  $('incomingCall').classList.add('hidden');
  stopRing();
  callType = call.callType || 'audio';
  activeCallRoomId = roomId;
  try {
    const constraints = call.callType === 'video' ? { video: true, audio: true } : { audio: true };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    $('localVideo').srcObject = localStream;
    $('localVideo').style.display = call.callType === 'video' ? 'block' : 'none';
    $('remoteVideo').style.display = call.callType === 'video' ? 'block' : 'none';
    $('callAvatarPlaceholder').style.display = call.callType === 'video' ? 'none' : 'flex';
    showCallOverlay('Connecting...');
    await createPeerConnection(roomId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(call.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await db.collection('calls').doc(roomId).update({
      answer: { type: answer.type, sdp: answer.sdp }, status: 'active'
    });
    startCallTimer();
  } catch(e) { showToast('Call error: ' + e.message, 'error', 'fa-times-circle'); hideCallOverlay(); }
}

function acceptCall() {}
function rejectCall() { $('incomingCall').classList.add('hidden'); stopRing(); }
function rejectCallWithId(roomId) {
  db.collection('calls').doc(roomId).update({ status: 'ended' }).catch(()=>{});
  $('incomingCall').classList.add('hidden');
  stopRing();
}

function listenCallAnswer(roomId) {
  const unsubscribe = db.collection('calls').doc(roomId).onSnapshot(async snap => {
    if (!snap.exists) return;
    const call = snap.data();
    if (call.answer && peerConnection && peerConnection.signalingState !== 'stable') {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(call.answer));
        stopRing();
        $('callStatus').textContent = 'Connected';
        startCallTimer();
      } catch(e) {}
    }
    if (call.status === 'ended') endCall();
  });
  activeListeners.push(unsubscribe);
}

async function createPeerConnection(roomId) {
  peerConnection = new RTCPeerConnection(ICE_SERVERS);
  localStream?.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
  remoteStream = new MediaStream();
  $('remoteVideo').srcObject = remoteStream;
  peerConnection.ontrack = e => { e.streams[0]?.getTracks().forEach(t => remoteStream.addTrack(t)); };
  peerConnection.onicecandidate = async e => {
    if (e.candidate) {
      await db.collection('calls').doc(roomId).collection('candidates').add({
        candidate: e.candidate.toJSON(), uid: currentUser.uid
      }).catch(()=>{});
    }
  };
  const unsubscribe = db.collection('calls').doc(roomId).collection('candidates')
    .where('uid', '!=', currentUser.uid)
    .onSnapshot(snap => {
      snap.docChanges().forEach(async change => {
        if (change.type === 'added') {
          try { await peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data().candidate)); } catch(e) {}
        }
      });
    });
  activeListeners.push(unsubscribe);
}

async function endCall() {
  stopRing();
  if (activeCallRoomId) db.collection('calls').doc(activeCallRoomId).update({ status: 'ended' }).catch(()=>{});
  localStream?.getTracks().forEach(t => t.stop());
  peerConnection?.close();
  peerConnection = null; localStream = null; remoteStream = null;
  clearInterval(callTimer); callSeconds = 0;
  $('callTimer').classList.add('hidden');
  $('callTimer').textContent = '00:00';
  hideCallOverlay();
  activeCallRoomId = null;
  isMuted = false; isCamOff = false;
  $('toggleMuteBtn').innerHTML = '<i class="fas fa-microphone"></i>';
  $('toggleMuteBtn').classList.remove('muted');
  $('toggleCamBtn').innerHTML = '<i class="fas fa-video"></i>';
  $('toggleCamBtn').classList.remove('muted');
  $('localVideo').style.opacity = '1';
}

function showCallOverlay(status) {
  $('callOverlay').classList.remove('hidden');
  $('callStatus').textContent = status;
  $('callRemoteName').textContent = currentRoom?.name || 'Ghost';
}
function hideCallOverlay() { $('callOverlay').classList.add('hidden'); }

function startCallTimer() {
  $('callStatus').textContent = '';
  $('callTimer').classList.remove('hidden');
  callTimer = setInterval(() => {
    callSeconds++;
    const m = String(Math.floor(callSeconds/60)).padStart(2,'0');
    const s = String(callSeconds%60).padStart(2,'0');
    $('callTimer').textContent = `${m}:${s}`;
  }, 1000);
}

function toggleMute() {
  if (!localStream) return;
  const tracks = localStream.getAudioTracks();
  if (!tracks.length) return;
  isMuted = !isMuted;
  tracks.forEach(t => { t.enabled = !isMuted; });
  $('toggleMuteBtn').innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
  $('toggleMuteBtn').classList.toggle('muted', isMuted);
}

function toggleCamera() {
  if (!localStream) return;
  const tracks = localStream.getVideoTracks();
  if (!tracks.length) return;
  isCamOff = !isCamOff;
  tracks.forEach(t => { t.enabled = !isCamOff; });
  $('toggleCamBtn').innerHTML = isCamOff ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
  $('toggleCamBtn').classList.toggle('muted', isCamOff);
  $('localVideo').style.opacity = isCamOff ? '0.3' : '1';
}

function playRing(outgoing) {
  const ring = $('ringAudio');
  ring.volume = outgoing ? 0.5 : 1;
  ring.play().catch(()=>{});
}
function stopRing() { $('ringAudio').pause(); $('ringAudio').currentTime = 0; }

// ── INSTAGRAM BTN ─────────────────────────────────────────
function setupInstagramBtn() {
  $('igBtn').onclick = () => window.open('https://www.instagram.com/heyy.anoop_', '_blank');
}

// ── DEV CREDIT / ADMIN ────────────────────────────────────
function setupDevCredit() {
  const credit = $('devCredit');
  credit.onclick = () => {
    devCreditTaps++;
    credit.classList.add('glow');
    clearTimeout(devCreditTimer);
    devCreditTimer = setTimeout(() => { devCreditTaps = 0; credit.classList.remove('glow'); }, 2000);
    if (devCreditTaps >= 3) {
      devCreditTaps = 0;
      credit.classList.remove('glow');
      showModal('adminAuthModal');
    }
  };

  $('adminAuthBtn').onclick = () => {
    const pass = $('adminPassInput').value;
    if (pass === ADMIN_PASS) {
      $('adminPassInput').value = '';
      hideModal('adminAuthModal');
      isAdminMode = true;
      showToast('Admin access granted 🛡️', 'success', 'fa-shield-alt');
      loadAdminPanel();
      showModal('adminPanel');
    } else {
      showToast('Wrong password', 'error', 'fa-times-circle');
      $('adminPassInput').value = '';
    }
  };

  $('adminPassInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('adminAuthBtn').click(); });

  $('adminLogout').onclick = () => { isAdminMode = false; hideModal('adminPanel'); };

  $('adminClearAllBtn').onclick = async () => {
    if (!confirm('Force clear ALL rooms? This deletes everything!')) return;
    try {
      const roomsSnap = await db.collection('rooms').get();
      for (const rdoc of roomsSnap.docs) {
        const msgs = await db.collection('rooms').doc(rdoc.id).collection('messages').get();
        const batch = db.batch();
        msgs.docs.forEach(d => batch.delete(d.ref));
        batch.delete(rdoc.ref);
        await batch.commit();
      }
      const userRooms = await db.collection('userRooms').get();
      const b2 = db.batch();
      userRooms.docs.forEach(d => b2.delete(d.ref));
      await b2.commit();
      showToast('All rooms cleared 💀', 'success', 'fa-skull');
      hideModal('adminPanel');
    } catch(e) { showToast('Error: ' + e.message, 'error', 'fa-times'); }
  };
}

async function loadAdminPanel() {
  try {
    const roomsSnap = await db.collection('rooms').get();
    const usersSnap = await db.collection('users').get();
    const onlineSnap = await db.collection('users').where('online','==',true).get();
    $('adminTotalRooms').textContent = roomsSnap.size;
    $('adminTotalUsers').textContent = usersSnap.size;
    $('adminOnlineUsers').textContent = onlineSnap.size;

    let totalMsgs = 0;
    const list = $('adminRoomsList');
    list.innerHTML = '';
    for (const doc of roomsSnap.docs) {
      const r = doc.data();
      const msgSnap = await db.collection('rooms').doc(doc.id).collection('messages').get();
      totalMsgs += msgSnap.size;
      const item = document.createElement('div');
      item.className = 'admin-room-item';
      item.innerHTML = `
        <div>
          <div class="admin-room-name">${escapeHTML(r.name)} ${r.passcode ? '🔒' : ''} ${r.vanishRoom ? '💀' : ''}</div>
          <div class="admin-room-meta">${r.code} · ${msgSnap.size} msgs · ${(r.members||[]).length} members</div>
        </div>
        <div class="admin-room-actions">
          <button class="admin-btn" onclick="adminClearChat('${doc.id}')">Clear</button>
          <button class="admin-btn del" onclick="adminDeleteRoom('${doc.id}','${escapeHTML(r.name)}')">Delete</button>
        </div>`;
      list.appendChild(item);
    }
    $('adminTotalMsgs').textContent = totalMsgs;
  } catch(e) { showToast('Admin load error: ' + e.message, 'error', 'fa-times'); }
}

window.adminClearChat = async (roomId) => {
  try {
    const msgs = await db.collection('rooms').doc(roomId).collection('messages').get();
    const batch = db.batch();
    msgs.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    showToast('Chat cleared', 'success', 'fa-check');
    loadAdminPanel();
  } catch(e) { showToast('Error: ' + e.message, 'error', 'fa-times'); }
};

window.adminDeleteRoom = async (roomId, roomName) => {
  await deleteRoomFull(roomId, roomName);
  loadAdminPanel();
};

// ── MODAL CLOSE ───────────────────────────────────────────
function setupModalClose() {
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.onclick = () => hideModal(btn.dataset.modal);
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.onclick = e => { if (e.target === overlay) overlay.classList.add('hidden'); };
  });
}

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const grid = $('emojiGrid');
  EMOJIS.forEach(e => {
    const s = document.createElement('span');
    s.className = 'emoji-item'; s.textContent = e;
    s.onclick = () => { $('msgInput').value += e; $('msgInput').focus(); $('emojiPicker').classList.add('hidden'); };
    grid.appendChild(s);
  });
  renderCallHistory();
  initAuth();
});

window.showToast = showToast;
