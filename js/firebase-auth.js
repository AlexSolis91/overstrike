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
            initGlobalChat(); // #5
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
            userRef.set({ name: currentUser.displayName, online: true, ts: Date.now(), uid: currentUser.uid });
            userRef.onDisconnect().remove();

            // Count online users and update players list
            db.ref('presence').on('value', function(snap) {
                const count = snap.numChildren();
                const el = document.getElementById('onlineCount');
                if (el) el.textContent = count;
                updatePlayersList(snap.val()); // #4
            });

            listenForChallenges(); // #4
        }

        // #4: Update active players list
        function updatePlayersList(presenceData) {
            const list = document.getElementById('playersList');
            if (!list || !presenceData) return;
            list.innerHTML = '';
            Object.entries(presenceData).forEach(function([uid, data]) {
                if (uid === currentUser.uid) return;
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 8px;background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.1);border-radius:8px;';
                const nameSpan = document.createElement('span');
                nameSpan.style.cssText = 'color:#ccc;font-size:.8rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                nameSpan.textContent = data.name || 'Jugador';
                const btns = document.createElement('div');
                btns.style.cssText = 'display:flex;gap:4px;flex-shrink:0;';

                const chatBtn = document.createElement('button');
                chatBtn.title = 'Chat privado';
                chatBtn.textContent = '💬';
                chatBtn.style.cssText = 'background:rgba(0,196,255,0.1);border:1px solid rgba(0,196,255,0.3);color:#00c4ff;border-radius:6px;padding:3px 7px;cursor:pointer;font-size:.8rem;';
                chatBtn.onclick = function() { openPrivateChat(uid, data.name); };

                const chalBtn = document.createElement('button');
                chalBtn.title = 'Desafiar';
                chalBtn.textContent = '⚔️';
                chalBtn.dataset.targetUid = uid;
                chalBtn.style.cssText = 'background:rgba(255,170,0,0.1);border:1px solid rgba(255,170,0,0.3);color:#ffaa00;border-radius:6px;padding:3px 7px;cursor:pointer;font-size:.8rem;';
                chalBtn.onclick = function() { sendChallenge(uid, data.name, chalBtn); };

                btns.appendChild(chatBtn);
                btns.appendChild(chalBtn);
                row.appendChild(nameSpan);
                row.appendChild(btns);
                list.appendChild(row);
            });
            if (list.children.length === 0) {
                list.innerHTML = '<div style="color:#444;font-size:.78rem;text-align:center;padding:.5rem;">No hay otros jugadores</div>';
            }
        }

        // #4: Send challenge
        let pendingChallengeId = null;
        function sendChallenge(targetUid, targetName, btn) {
            if (!currentUser) return;
            if (pendingChallengeId) {
                db.ref('challenges/' + pendingChallengeId).remove();
                pendingChallengeId = null;
            }
            const chalId = currentUser.uid + '_' + targetUid;
            pendingChallengeId = chalId;
            db.ref('challenges/' + chalId).set({
                fromUid: currentUser.uid,
                fromName: currentUser.displayName || 'Jugador',
                toUid: targetUid,
                status: 'pending',
                ts: Date.now()
            });
            btn.textContent = '⏳';
            btn.disabled = true;
            btn.title = 'Desafío enviado — click para cancelar';
            btn.onclick = function() { cancelChallenge(chalId, btn, targetUid, targetName); };

            db.ref('challenges/' + chalId + '/status').on('value', function(snap) {
                const status = snap.val();
                if (status === 'accepted') {
                    db.ref('challenges/' + chalId + '/status').off();
                    pendingChallengeId = null;
                    const roomId = generateRoomCode();
                    db.ref('challenges/' + chalId).update({ roomId: roomId });
                    createOnlineRoomFromChallenge(roomId, chalId);
                } else if (status === 'rejected') {
                    db.ref('challenges/' + chalId + '/status').off();
                    db.ref('challenges/' + chalId).remove();
                    pendingChallengeId = null;
                    btn.textContent = '⚔️';
                    btn.disabled = false;
                    btn.onclick = function() { sendChallenge(targetUid, targetName, btn); };
                    alert(targetName + ' rechazó el desafío.');
                }
            });
        }

        function cancelChallenge(chalId, btn, targetUid, targetName) {
            db.ref('challenges/' + chalId).remove();
            pendingChallengeId = null;
            if (btn) {
                btn.textContent = '⚔️';
                btn.disabled = false;
                btn.onclick = function() { sendChallenge(targetUid, targetName, btn); };
            }
        }

        // #4: Listen for incoming challenges
        let activeChallengeId = null;
        function listenForChallenges() {
            if (!currentUser) return;
            db.ref('challenges').orderByChild('toUid').equalTo(currentUser.uid).on('child_added', function(snap) {
                const chal = snap.val();
                if (!chal || chal.status !== 'pending') return;
                activeChallengeId = snap.key;
                const modal = document.getElementById('challengeModal');
                if (modal) {
                    document.getElementById('challengeModalText').textContent = (chal.fromName || 'Alguien') + ' te desafía a una batalla.';
                    modal.style.display = 'flex';
                }
            });
        }

        function respondChallenge(accept) {
            const modal = document.getElementById('challengeModal');
            if (modal) modal.style.display = 'none';
            if (!activeChallengeId) return;
            if (accept) {
                db.ref('challenges/' + activeChallengeId + '/status').set('accepted');
                db.ref('challenges/' + activeChallengeId + '/roomId').on('value', function(snap) {
                    const roomId = snap.val();
                    if (!roomId) return;
                    db.ref('challenges/' + activeChallengeId + '/roomId').off();
                    db.ref('challenges/' + activeChallengeId).remove();
                    activeChallengeId = null;
                    joinRoom(roomId);
                });
            } else {
                db.ref('challenges/' + activeChallengeId + '/status').set('rejected');
                setTimeout(function() {
                    if (activeChallengeId) db.ref('challenges/' + activeChallengeId).remove();
                }, 2000);
                activeChallengeId = null;
            }
        }

        function createOnlineRoomFromChallenge(roomId, chalId) {
            currentRoomId = roomId;
            isRoomHost = true;
            onlineMode = true;
            db.ref('rooms/' + roomId).set({
                host: { uid: currentUser.uid, name: currentUser.displayName, photo: currentUser.photoURL || '' },
                guest: null,
                status: 'waiting',
                created: Date.now()
            }).then(function() {
                db.ref('challenges/' + chalId).remove();
                showScreen('waitingScreen');
                document.getElementById('waitingRoomCode').textContent = roomId;
                document.getElementById('waitingStatus').textContent = '⏳ Conectando con rival...';
                listenForGuest(roomId);
            });
        }

        // #4: Private chat
        let privateChatTarget = null;
        let privateChatRef = null;
        function openPrivateChat(targetUid, targetName) {
            privateChatTarget = { uid: targetUid, name: targetName };
            let panel = document.getElementById('privateChatPanel');
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'privateChatPanel';
                panel.style.cssText = 'position:fixed;bottom:20px;right:20px;width:300px;height:380px;background:#0a0e17;border:2px solid rgba(0,196,255,0.4);border-radius:16px;display:flex;flex-direction:column;z-index:8000;box-shadow:0 0 30px rgba(0,196,255,0.2);';
                panel.innerHTML = [
                    '<div style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(0,196,255,0.15);">',
                    '<span id="privateChatTitle" style="font-family:Orbitron,sans-serif;font-size:.78rem;color:#00c4ff;"></span>',
                    '<button onclick="closePrivateChat()" style="background:none;border:none;color:#666;cursor:pointer;font-size:1rem;">✕</button>',
                    '</div>',
                    '<div id="privateChatMessages" style="flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:6px;"></div>',
                    '<div style="display:flex;gap:6px;padding:10px;border-top:1px solid rgba(0,196,255,0.1);">',
                    '<input id="privateChatInput" type="text" placeholder="Mensaje..." maxlength="120" style="flex:1;background:rgba(0,196,255,0.07);border:1px solid rgba(0,196,255,0.2);border-radius:8px;padding:7px 10px;color:#fff;font-size:.8rem;outline:none;" onkeydown="if(event.key===\'Enter\') sendPrivateMessage()">',
                    '<button onclick="sendPrivateMessage()" style="background:linear-gradient(135deg,#003a5c,#006fa6);border:none;color:#00c4ff;border-radius:8px;padding:7px 12px;cursor:pointer;">➤</button>',
                    '</div>'
                ].join('');
                document.body.appendChild(panel);
            }
            document.getElementById('privateChatTitle').textContent = '💬 ' + targetName;
            document.getElementById('privateChatMessages').innerHTML = '';
            panel.style.display = 'flex';

            if (privateChatRef) privateChatRef.off();
            const chatKey = [currentUser.uid, targetUid].sort().join('_');
            privateChatRef = db.ref('privateChats/' + chatKey);
            privateChatRef.limitToLast(50).on('child_added', function(snap) {
                const msg = snap.val();
                if (!msg) return;
                const isMe = msg.uid === currentUser.uid;
                const el = document.createElement('div');
                el.style.cssText = 'max-width:80%;padding:6px 10px;border-radius:10px;font-size:.78rem;word-break:break-word;' + (isMe ? 'align-self:flex-end;background:rgba(0,196,255,0.15);color:#fff;' : 'align-self:flex-start;background:rgba(255,255,255,0.07);color:#ccc;');
                el.innerHTML = '<span style="font-size:.68rem;color:#666;display:block;">' + escapeHtml(msg.name) + '</span>' + escapeHtml(msg.text);
                document.getElementById('privateChatMessages').appendChild(el);
                document.getElementById('privateChatMessages').scrollTop = 99999;
            });
        }

        function closePrivateChat() {
            const panel = document.getElementById('privateChatPanel');
            if (panel) panel.style.display = 'none';
            if (privateChatRef) { privateChatRef.off(); privateChatRef = null; }
        }

        function sendPrivateMessage() {
            if (!privateChatTarget || !currentUser) return;
            const input = document.getElementById('privateChatInput');
            const text = (input && input.value.trim()) || '';
            if (!text) return;
            input.value = '';
            const chatKey = [currentUser.uid, privateChatTarget.uid].sort().join('_');
            db.ref('privateChats/' + chatKey).push({
                uid: currentUser.uid,
                name: currentUser.displayName || 'Jugador',
                text: text,
                ts: Date.now()
            });
        }

        // #5: Global lobby chat
        let globalChatListener = null;
        function initGlobalChat() {
            if (globalChatListener) return;
            const chatRef = db.ref('globalChat');
            globalChatListener = chatRef.limitToLast(60).on('child_added', function(snap) {
                const msg = snap.val();
                if (!msg) return;
                const isMe = currentUser && msg.uid === currentUser.uid;
                const el = document.createElement('div');
                el.style.cssText = 'max-width:85%;padding:5px 9px;border-radius:8px;font-size:.78rem;word-break:break-word;' + (isMe ? 'align-self:flex-end;background:rgba(255,170,0,0.15);color:#fff;' : 'align-self:flex-start;background:rgba(255,255,255,0.06);color:#ccc;');
                el.innerHTML = '<span style="font-size:.68rem;color:#888;display:block;">' + escapeHtml(msg.name) + '</span>' + escapeHtml(msg.text);
                const container = document.getElementById('globalChatMessages');
                if (container) { container.appendChild(el); container.scrollTop = 99999; }
            });
        }

        function sendGlobalChat() {
            if (!currentUser) return;
            const input = document.getElementById('globalChatInput');
            const text = (input && input.value.trim()) || '';
            if (!text) return;
            input.value = '';
            db.ref('globalChat').push({
                uid: currentUser.uid,
                name: currentUser.displayName || 'Jugador',
                text: text,
                ts: Date.now()
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
