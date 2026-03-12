        // ==================== FIREBASE CONFIG & AUTH ====================
        const firebaseConfig = {
            apiKey: "AIzaSyChCFsE6F4iO97iH1ItFWCJtHU-XoA5Ruk",
            authDomain: "overstrike-game.firebaseapp.com",
            databaseURL: "https://overstrike-game-default-rtdb.firebaseio.com",
            projectId: "overstrike-game",
            storageBucket: "overstrike-game.firebasestorage.app",
            messagingSenderId: "685184595019",
            appId: "1:685184595019:web:24791d11451b8ee8aec9ce"
        };

        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.database();

        // ── Current user & room state ──
        let currentUser = null;
        let currentRoomId = null;
        let isRoomHost = false;
        let onlineMode = false;
        let chatOpen = false;
        let unreadMessages = 0;
        let roomListener = null;
        let chatListener = null;

        // ── Auth state listener ──
        auth.onAuthStateChanged(function(user) {
            if (user) {
                currentUser = user;
                document.getElementById('loginScreen').style.display = 'none';
                showLobby();
            } else {
                currentUser = null;
                showScreen('loginScreen');
            }
        });

        function showScreen(id) {
            ['loginScreen','lobbyScreen','waitingScreen','modeSelectScreen','charSelectScreen'].forEach(function(s) {
                const el = document.getElementById(s);
                if (el) el.style.display = 'none';
            });
            const target = document.getElementById(id);
            if (!target) return;
            if (id === 'lobbyScreen' || id === 'waitingScreen') target.style.display = 'flex';
            else if (id === 'modeSelectScreen') target.style.display = 'flex';
            else if (id === 'loginScreen') target.style.display = 'flex';
            else target.style.display = 'block';
        }

        function signInWithGoogle() {
            const btn = document.getElementById('googleLoginBtn');
            btn.disabled = true;
            btn.style.opacity = '0.7';
            document.getElementById('loginStatus').textContent = 'Conectando...';
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).then(function(result) {
                // onAuthStateChanged handles the rest
            }).catch(function(err) {
                btn.disabled = false;
                btn.style.opacity = '1';
                document.getElementById('loginStatus').textContent = 'Error: ' + err.message;
                console.error('Login error:', err);
            });
        }

        function signOut() {
            if (currentRoomId) cancelRoom();
            auth.signOut().then(function() {
                showScreen('loginScreen');
                document.getElementById('loginStatus').textContent = '';
            });
        }

        // ── Lobby ──
        function showLobby() {
            showScreen('lobbyScreen');
            document.getElementById('lobbyUserName').textContent = currentUser.displayName || currentUser.email;
            const photo = document.getElementById('lobbyUserPhoto');
            if (currentUser.photoURL) photo.src = currentUser.photoURL;
            else photo.style.display = 'none';
            refreshRooms();
            trackOnlinePresence();
        }

        function goToLocalMode(mode) {
            showScreen('modeSelectScreen');
            const backBtn = document.getElementById('backToLobbyBtn');
            if (backBtn) backBtn.style.display = 'block';
            // Trigger existing local mode selection
            setTimeout(function() { csSelectMode(mode); }, 100);
        }

        function trackOnlinePresence() {
            if (!currentUser) return;
            const userRef = db.ref('presence/' + currentUser.uid);
            userRef.set({ name: currentUser.displayName, online: true, ts: Date.now() });
            userRef.onDisconnect().remove();

            // Count online users
            db.ref('presence').on('value', function(snap) {
                const count = snap.numChildren();
                const el = document.getElementById('onlineCount');
                if (el) el.textContent = count + ' jugador' + (count !== 1 ? 'es' : '') + ' en línea';
            });
        }

        // ── Room management ──
        function generateRoomCode() {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = '';
            for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
            return code;
        }

        function createOnlineRoom() {
            if (!currentUser) return;
            const roomId = generateRoomCode();
            currentRoomId = roomId;
            isRoomHost = true;
            onlineMode = true;

            db.ref('rooms/' + roomId).set({
                host: { uid: currentUser.uid, name: currentUser.displayName, photo: currentUser.photoURL || '' },
                guest: null,
                status: 'waiting',
                created: Date.now()
            }).then(function() {
                showScreen('waitingScreen');
                document.getElementById('waitingRoomCode').textContent = roomId;
                document.getElementById('waitingStatus').textContent = '⏳ Esperando oponente...';
                listenForGuest(roomId);
            });
        }

        function listenForGuest(roomId) {
            roomListener = db.ref('rooms/' + roomId).on('value', function(snap) {
                const room = snap.val();
                if (!room) return;
                if (room.guest && room.status === 'ready') {
                    document.getElementById('waitingStatus').textContent = '✅ ' + room.guest.name + ' se unió! Iniciando...';
                    setTimeout(function() { startOnlineGame(roomId, true); }, 1500);
                }
            });
        }

        function refreshRooms() {
            const list = document.getElementById('roomsList');
            if (!list) return;
            list.innerHTML = '<div style="text-align:center;color:#444;padding:1.5rem;font-size:.85rem;">Buscando salas...</div>';

            db.ref('rooms').orderByChild('status').equalTo('waiting').limitToLast(10).once('value', function(snap) {
                list.innerHTML = '';
                const rooms = snap.val();
                if (!rooms || Object.keys(rooms).length === 0) {
                    list.innerHTML = '<div style="text-align:center;color:#444;padding:2rem;font-size:.85rem;">No hay salas disponibles.<br><span style="color:#666;">¡Crea una y espera un rival!</span></div>';
                    return;
                }
                Object.entries(rooms).forEach(function([roomId, room]) {
                    if (room.host && room.host.uid === currentUser.uid) return; // skip own rooms
                    const card = document.createElement('div');
                    card.style.cssText = 'background:rgba(0,196,255,0.06);border:1px solid rgba(0,196,255,0.15);border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;';
                    const hostName2 = (room.host.name || 'Jugador').replace(/</g,'&lt;');
                    card.innerHTML = [
                        '<div>',
                            '<div style="font-weight:700;color:#fff;font-size:.9rem;">' + hostName2 + '</div>',
                            '<div style="font-size:.75rem;color:#666;">Sala: <span style="color:#00c4ff;font-family:Orbitron,sans-serif;">' + roomId + '</span></div>',
                        '</div>',
                        '<button data-rid="' + roomId + '" style="background:linear-gradient(135deg,#003a5c,#006fa6);border:1px solid #00c4ff;color:#00c4ff;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:.8rem;font-family:Orbitron,sans-serif;">UNIRSE</button>'
                    ].join('');
                    card.querySelector('button').addEventListener('click', function() { joinRoom(roomId); });
                    list.appendChild(card);
                });
                if (list.children.length === 0) {
                    list.innerHTML = '<div style="text-align:center;color:#444;padding:2rem;font-size:.85rem;">No hay salas de otros jugadores.</div>';
                }
            });
        }

        function joinRoom(roomId) {
            if (!currentUser) return;
            currentRoomId = roomId;
            isRoomHost = false;
            onlineMode = true;

            db.ref('rooms/' + roomId + '/guest').set({
                uid: currentUser.uid,
                name: currentUser.displayName,
                photo: currentUser.photoURL || ''
            }).then(function() {
                return db.ref('rooms/' + roomId + '/status').set('ready');
            }).then(function() {
                startOnlineGame(roomId, false);
            });
        }

        function cancelRoom() {
            if (currentRoomId && isRoomHost) {
                db.ref('rooms/' + currentRoomId).remove();
            }
            if (roomListener) { db.ref('rooms/' + currentRoomId).off('value', roomListener); roomListener = null; }
            currentRoomId = null;
            isRoomHost = false;
            onlineMode = false;
            showLobby();
        }

        function startOnlineGame(roomId, asHost) {
            if (roomListener) { db.ref('rooms/' + roomId).off('value', roomListener); roomListener = null; }
            onlineMode = true;
            isRoomHost = asHost;
            currentRoomId = roomId;

            // Reset csState completely
            csState.team1 = [];
            csState.team2 = [];
            csState.phase = 'team1'; // will be overridden below
            csState.pendingChar = null;
            csState.gameMode = 'online';
            csState.onlineTeam = asHost ? 'team1' : 'team2';

            showScreen('charSelectScreen');
            initChat(roomId);

            // Update label to show which team this player is
            const lbl = document.getElementById('csPhaseLabel');
            if (asHost) {
                lbl.textContent = '🔷 HUNTERS — Elige tus 5 personajes';
                lbl.className = 'cs-phase-label team1';
            } else {
                lbl.textContent = '🔶 REAPERS — Elige tus 5 personajes';
                lbl.className = 'cs-phase-label team2';
            }

            console.log('[OVERSTRIKE DEBUG] startOnlineGame: asHost=', asHost, '| onlineTeam=', csState.onlineTeam, '| gameMode=', csState.gameMode);
            csInit();
            listenForOnlineReady(roomId, csState.onlineTeam);
        }

        function listenForOnlineReady(roomId, myTeam) {
            const opponentTeam = myTeam === 'team1' ? 'team2' : 'team1';
            db.ref('rooms/' + roomId + '/selections').on('value', function(snap) {
                const data = snap.val() || {};
                const myReady = data[myTeam + '_ready'];
                const oppReady = data[opponentTeam + '_ready'];

                // Update status label only — do NOT touch panel innerHTML
                const statusEl = document.getElementById('onlineOppStatus');
                if (statusEl) {
                    statusEl.textContent = oppReady ? '✅ ¡Oponente listo!' : '⏳ Oponente eligiendo...';
                    statusEl.style.color = oppReady ? '#00ff88' : '#666';
                }

                // Both ready → load opponent picks and start
                if (myReady && oppReady && data[opponentTeam + '_picks']) {
                    csState[opponentTeam] = data[opponentTeam + '_picks'];
                    db.ref('rooms/' + roomId + '/selections').off();
                    csStartGame();
                }
            });
        }

        function showOnlineReadyBtn() {
            const btn = document.getElementById('onlineReadyBtn');
            if (btn) btn.style.display = 'flex';
        }

        function submitOnlineReady() {
            if (!currentRoomId || !currentUser) return;
            const myTeam = isRoomHost ? 'team1' : 'team2';
            const myPicks = csState[myTeam];
            if (!myPicks || myPicks.length < 5) {
                alert('Debes elegir 5 personajes primero.');
                return;
            }
            // Show waiting state
            const innerBtn = document.getElementById('onlineReadyBtnInner');
            if (innerBtn) {
                innerBtn.disabled = true;
                innerBtn.textContent = '⏳ Esperando oponente...';
                innerBtn.style.background = 'linear-gradient(135deg,#1a1a1a,#2a2a2a)';
                innerBtn.style.color = '#888';
                innerBtn.style.borderColor = '#444';
                innerBtn.style.boxShadow = 'none';
                innerBtn.style.cursor = 'default';
            }

            db.ref('rooms/' + currentRoomId + '/selections').update({
                [myTeam + '_picks']: myPicks,
                [myTeam + '_ready']: true
            });
        }

        // ── CHAT ──
        function initChat(roomId) {
            document.getElementById('chatToggleBtn').style.display = 'flex';
            const chatRef = db.ref('rooms/' + roomId + '/chat');
            chatListener = chatRef.on('child_added', function(snap) {
                const msg = snap.val();
                if (!msg) return;
                const isMe = msg.uid === currentUser.uid;
                const msgEl = document.createElement('div');
                msgEl.className = 'chat-msg' + (isMe ? ' mine' : '');
                msgEl.innerHTML = '<span class="chat-author">' + escapeHtml(msg.name) + '</span><br><span class="chat-text">' + escapeHtml(msg.text) + '</span>';
                document.getElementById('chatMessages').appendChild(msgEl);
                document.getElementById('chatMessages').scrollTop = 99999;

                if (!chatOpen && !isMe) {
                    unreadMessages++;
                    const badge = document.getElementById('chatUnreadBadge');
                    badge.textContent = unreadMessages;
                    badge.style.display = 'flex';
                }
            });
        }

        function toggleChat() {
            chatOpen = !chatOpen;
            const panel = document.getElementById('chatPanel');
            panel.style.display = chatOpen ? 'flex' : 'none';
            if (chatOpen) {
                unreadMessages = 0;
                document.getElementById('chatUnreadBadge').style.display = 'none';
                document.getElementById('chatMessages').scrollTop = 99999;
                setTimeout(function() { document.getElementById('chatInput').focus(); }, 100);
            }
        }

        function sendChatMessage() {
            const input = document.getElementById('chatInput');
            const text = input.value.trim();
            if (!text || !currentRoomId || !currentUser) return;
            input.value = '';
            db.ref('rooms/' + currentRoomId + '/chat').push({
                uid: currentUser.uid,
                name: currentUser.displayName || 'Jugador',
                text: text,
                ts: Date.now()
            });
        }

        function escapeHtml(str) {
            return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        // Show chat in local/solo mode too? No — hide unless online
        function hideChatUI() {
            document.getElementById('chatToggleBtn').style.display = 'none';
            document.getElementById('chatPanel').style.display = 'none';
            chatOpen = false;
            if (chatListener && currentRoomId) {
                db.ref('rooms/' + currentRoomId + '/chat').off('child_added', chatListener);
                chatListener = null;
            }
        }

        // ── Override csSelectMode for local modes from lobby ──
        // (original csSelectMode is defined later — we patch after load)
        window.addEventListener('DOMContentLoaded', function() {
            // loginScreen shown by default, Firebase auth decides next
        });

