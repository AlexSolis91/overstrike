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
            // Go directly to char select - skip modeSelectScreen entirely from lobby
            csSelectMode(mode);
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
            const newMsg = {
                uid: currentUser.uid,
                name: currentUser.displayName || 'Jugador',
                text: text,
                ts: Date.now()
            };
            // Enforce max 30 messages: read current count, delete oldest if needed
            const chatRef = db.ref('globalChat');
            chatRef.once('value', function(snap) {
                const msgs = snap.val();
                const keys = msgs ? Object.keys(msgs) : [];
                if (keys.length >= 30) {
                    // Sort by ts and delete oldest
                    const sorted = keys.sort(function(a, b) {
                        return (msgs[a].ts || 0) - (msgs[b].ts || 0);
                    });
                    const toDelete = sorted.slice(0, keys.length - 29); // keep 29, add 1 = 30
                    const updates = {};
                    toDelete.forEach(function(k) { updates[k] = null; });
                    chatRef.update(updates).then(function() { chatRef.push(newMsg); });
                } else {
                    chatRef.push(newMsg);
                }
            });
        }


        // ════════════════════════════════════════════════
        // MODO RANKED
        // ════════════════════════════════════════════════
        const RANKED_FAKE_NAMES = ['Richo92', 'ManuEx', 'Dante777', 'LoboREX', 'MarcoAntonio', 'JesusGz', 'Leonheart', 'Arturo', 'Rois Najera', 'David89', 'Erikkson10', 'Klaord', 'Carlos Cortes', 'Alexis', 'ViktorBaezzz', 'DonaldTrump22', 'Elbicho', 'ValeriaBitz', 'Jorge Vz', 'Porfirio', 'D3XTER', 'Don RAMON', 'Lieerey', 'MR poop', 'yorobot', 'Vicente Martinez', 'Cavendish', 'Vinchester', 'GoodZilla', 'Nikoory', 'Zamael', 'Draxler'];
        let rankedMatchmakingTimer = null;
        let rankedMatchmakingListener = null;

        function startRankedMatchmaking() {
            if (!currentUser) return;
            const myUid = currentUser.uid;
            const myName = currentUser.displayName || 'Jugador';

            // Show searching modal
            showRankedSearchModal();

            // Register in matchmaking queue
            const queueRef = db.ref('ranked_queue/' + myUid);
            queueRef.set({ uid: myUid, name: myName, ts: Date.now() });
            queueRef.onDisconnect().remove();

            // Look for another player in the queue
            let matched = false;
            rankedMatchmakingListener = db.ref('ranked_queue').on('value', function(snap) {
                if (matched) return;
                const queue = snap.val() || {};
                const others = Object.entries(queue).filter(([uid]) => uid !== myUid);
                if (others.length === 0) return;

                // Pick the first other player
                const [opponentUid, opponentData] = others[0];
                // The player with the smaller UID becomes host (deterministic)
                const iAmHost = myUid < opponentUid;
                matched = true;
                clearRankedTimer();
                db.ref('ranked_queue/' + myUid).remove();

                if (iAmHost) {
                    // Create a room and update queue entry to signal match
                    const roomId = 'R_' + generateRoomCode();
                    db.ref('ranked_queue/' + opponentUid).update({ matchedRoomId: roomId, matchedBy: myUid });
                    currentRoomId = roomId;
                    isRoomHost = true;
                    onlineMode = true;
                    db.ref('rooms/' + roomId).set({
                        host: { uid: myUid, name: myName, photo: currentUser.photoURL || '' },
                        guest: { uid: opponentUid, name: opponentData.name || 'Rival' },
                        status: 'ready',
                        ranked: true,
                        created: Date.now()
                    }).then(function() {
                        hideRankedSearchModal();
                        db.ref('ranked_queue').off('value', rankedMatchmakingListener);
                        // Record ranked match start for stats
                        window._rankedRoomId = roomId;
                        window._rankedOpponentName = opponentData.name || 'Rival';
                        startOnlineGame(roomId, true);
                    });
                } else {
                    // Wait to receive the matchedRoomId
                    db.ref('ranked_queue/' + myUid + '/matchedRoomId').on('value', function(s) {
                        const rid = s.val();
                        if (!rid) return;
                        db.ref('ranked_queue/' + myUid + '/matchedRoomId').off();
                        db.ref('ranked_queue/' + myUid).remove();
                        matched = true;
                        clearRankedTimer();
                        hideRankedSearchModal();
                        db.ref('ranked_queue').off('value', rankedMatchmakingListener);
                        currentRoomId = rid;
                        isRoomHost = false;
                        onlineMode = true;
                        window._rankedRoomId = rid;
                        window._rankedOpponentName = opponentData.name || 'Rival';
                        db.ref('rooms/' + rid + '/guest').set({
                            uid: myUid, name: myName, photo: currentUser.photoURL || ''
                        }).then(function() {
                            startOnlineGame(rid, false);
                        });
                    });
                }
            });

            // 10 second timer — if no match found, start vs IA with fake name
            rankedMatchmakingTimer = setTimeout(function() {
                if (matched) return;
                matched = true;
                clearRankedTimer();
                if (rankedMatchmakingListener) {
                    db.ref('ranked_queue').off('value', rankedMatchmakingListener);
                    rankedMatchmakingListener = null;
                }
                db.ref('ranked_queue/' + myUid).remove();
                hideRankedSearchModal();
                // Pick a random fake opponent name
                const fakeName = RANKED_FAKE_NAMES[Math.floor(Math.random() * RANKED_FAKE_NAMES.length)];
                window._rankedFakeOpponent = fakeName;
                window._rankedRoomId = null; // vs IA, no real room
                // Start solo game (vs IA), mode = 'ranked_solo' 
                csState.team1 = [];
                csState.team2 = [];
                csState.phase = 'team1';
                csState.gameMode = 'solo';
                csState.pendingChar = null;
                window._rankedMode = true;
                showScreen('charSelectScreen');
                csInit();
                audioManager.play('audioMenu');
            }, 10000);
        }

        function clearRankedTimer() {
            if (rankedMatchmakingTimer) { clearTimeout(rankedMatchmakingTimer); rankedMatchmakingTimer = null; }
        }

        let rankedSearchInterval = null;
        function showRankedSearchModal() {
            let modal = document.getElementById('rankedSearchModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'rankedSearchModal';
                modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:10000;display:flex;align-items:center;justify-content:center;';
                modal.innerHTML = [
                    '<div style="background:linear-gradient(135deg,#0a0e17,#0d1525);border:2px solid #ffaa00;border-radius:20px;padding:2.5rem 3rem;text-align:center;max-width:380px;box-shadow:0 0 50px rgba(255,170,0,0.3);">',
                    '<div style="font-size:2.5rem;margin-bottom:.8rem;animation:loginPulse 1s infinite;">🔍</div>',
                    '<div style="font-family:Orbitron,sans-serif;font-size:1.1rem;color:#ffaa00;margin-bottom:.5rem;letter-spacing:.1em;">BUSCANDO RIVAL...</div>',
                    '<div style="color:#888;font-size:.85rem;margin-bottom:1.5rem;">Conectando con otro jugador online</div>',
                    '<div id="rankedTimerDisplay" style="font-family:Orbitron,sans-serif;font-size:2rem;color:#fff;margin-bottom:1.5rem;">10</div>',
                    '<div style="width:100%;height:4px;background:rgba(255,170,0,0.2);border-radius:2px;overflow:hidden;">',
                    '<div id="rankedTimerBar" style="height:100%;background:linear-gradient(90deg,#ffaa00,#ff6600);width:100%;transition:width 1s linear;border-radius:2px;"></div>',
                    '</div>',
                    '<button onclick="cancelRankedSearch()" style="margin-top:1.5rem;background:rgba(255,51,102,0.15);border:1px solid #ff3366;color:#ff3366;border-radius:10px;padding:10px 24px;cursor:pointer;font-size:.85rem;">Cancelar</button>',
                    '</div>'
                ].join('');
            }
            modal.style.display = 'flex';
            // Countdown animation
            let timeLeft = 10;
            const timerEl = document.getElementById('rankedTimerDisplay');
            const barEl = document.getElementById('rankedTimerBar');
            if (timerEl) timerEl.textContent = '10';
            if (barEl) barEl.style.width = '100%';
            if (rankedSearchInterval) clearInterval(rankedSearchInterval);
            rankedSearchInterval = setInterval(function() {
                timeLeft--;
                if (timerEl) timerEl.textContent = timeLeft;
                if (barEl) barEl.style.width = (timeLeft * 10) + '%';
                if (timeLeft <= 0) clearInterval(rankedSearchInterval);
            }, 1000);
        }

        function hideRankedSearchModal() {
            const modal = document.getElementById('rankedSearchModal');
            if (modal) modal.style.display = 'none';
            if (rankedSearchInterval) { clearInterval(rankedSearchInterval); rankedSearchInterval = null; }
        }

        function cancelRankedSearch() {
            clearRankedTimer();
            if (rankedMatchmakingListener) {
                db.ref('ranked_queue').off('value', rankedMatchmakingListener);
                rankedMatchmakingListener = null;
            }
            if (currentUser) db.ref('ranked_queue/' + currentUser.uid).remove();
            hideRankedSearchModal();
        }

        // ════════════════════════════════════════════════
        // RANKED STATS — guardar resultado al final de la partida
        // ════════════════════════════════════════════════
        function saveRankedResult(winnerTeam, playerTeam, playerChars, opponentName, opponentChars) {
            if (!currentUser || !window._rankedMode) return;
            window._rankedMode = false;
            const myUid = currentUser.uid;
                        const myName = currentUser.displayName || 'Jugador';
            const won = (winnerTeam === playerTeam);
            const fakeOpp = window._rankedFakeOpponent || opponentName;
            window._rankedFakeOpponent = null;

            // Save my stats
            const myRef = db.ref('ranked_stats/' + myUid);
            myRef.once('value', function(snap) {
                const cur = snap.val() || { wins: 0, losses: 0, name: myName, charUsage: {} };
                cur.name = myName;
                cur.wins = (cur.wins || 0) + (won ? 1 : 0);
                cur.losses = (cur.losses || 0) + (won ? 0 : 1);
                cur.charUsage = cur.charUsage || {};
                (playerChars || []).forEach(function(c) { cur.charUsage[c] = (cur.charUsage[c] || 0) + 1; });
                myRef.set(cur);
            });

            // Save fake opponent stats (keyed by name, not uid)
            if (fakeOpp) {
                const oppKey = 'fake_' + fakeOpp.replace(/[^a-zA-Z0-9]/g, '_');
                const oppRef = db.ref('ranked_stats/' + oppKey);
                oppRef.once('value', function(snap) {
                    const cur = snap.val() || { wins: 0, losses: 0, name: fakeOpp, isFake: true, charUsage: {} };
                    cur.wins = (cur.wins || 0) + (won ? 0 : 1);
                    cur.losses = (cur.losses || 0) + (won ? 1 : 0);
                    cur.charUsage = cur.charUsage || {};
                    (opponentChars || []).forEach(function(c) { cur.charUsage[c] = (cur.charUsage[c] || 0) + 1; });
                    oppRef.set(cur);
                });
            }
        }

        // ════════════════════════════════════════════════
        // LEADERBOARD
        // ════════════════════════════════════════════════
        function showLeaderboard() {
            let modal = document.getElementById('leaderboardModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'leaderboardModal';
                modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:10000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;box-sizing:border-box;';
                modal.innerHTML = [
                    '<div style="width:100%;max-width:800px;background:#0a0e17;border:2px solid #ffaa00;border-radius:20px;padding:24px;">',
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">',
                    '<div style="font-family:Orbitron,sans-serif;font-size:1.2rem;color:#ffaa00;text-shadow:0 0 12px #ffaa00;">&#x1F3C6; RANKED LEADERBOARD</div>',
                    '<button id="leaderboardCloseBtn" style="background:#ff4466;border:none;color:#fff;font-size:1.1rem;width:34px;height:34px;border-radius:50%;cursor:pointer;">&#x2715;</button>',
                    '</div>',
                    '<div id="leaderboardContent" style="color:#888;text-align:center;padding:2rem;">Cargando estad\u00edsticas...</div>',
                    '</div>'
                ].join('');
                document.getElementById('leaderboardCloseBtn').onclick = function() {
                    document.getElementById('leaderboardModal').style.display = 'none';
                };
                document.body.appendChild(modal);
            }
            modal.style.display = 'flex';
            loadLeaderboardData();
        }

        function loadLeaderboardData() {
            db.ref('ranked_stats').once('value', function(snap) {
                const data = snap.val() || {};
                const entries = Object.entries(data).map(function([key, v]) {
                    const total = (v.wins || 0) + (v.losses || 0);
                    const wr = total > 0 ? Math.round((v.wins / total) * 100) : 0;
                    return { key, name: v.name || key, wins: v.wins || 0, losses: v.losses || 0,
                             total, wr, isFake: v.isFake || false, charUsage: v.charUsage || {} };
                });
                // Sort by wins desc, then winrate
                entries.sort(function(a, b) { return b.wins - a.wins || b.wr - a.wr; });
                renderLeaderboard(entries);
            });
        }

        function renderLeaderboard(entries) {
            const container = document.getElementById('leaderboardContent');
            if (!entries.length) {
                container.innerHTML = '<div style="color:#555;text-align:center;padding:3rem;font-size:.9rem;">Aún no hay partidas Ranked jugadas.<br><span style="color:#444;">¡Sé el primero en jugar!</span></div>';
                return;
            }
            const rows = entries.map(function(e, i) {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
                const rankColor = i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#aaa';
                const fakeTag = e.isFake ? '<span style="font-size:.65rem;color:#666;background:rgba(255,255,255,0.05);border:1px solid #333;border-radius:4px;padding:1px 5px;margin-left:5px;">IA</span>' : '';
                // Top 5 chars
                const topChars = getTopChars(e.charUsage, 5);
                const charImgs = topChars.map(function(c) {
                    return '<img src="' + getCharPortrait(c) + '" title="' + escapeHtml(c) + '" style="width:32px;height:32px;border-radius:6px;border:1px solid #333;object-fit:cover;" onerror="this.style.display=&quot;none&quot;">';
                }).join('');
                return [
                    '<div style="background:rgba(255,170,0,0.04);border:1px solid rgba(255,170,0,0.12);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">',
                    '<div style="font-family:Orbitron,sans-serif;font-size:1.1rem;color:' + rankColor + ';min-width:32px;">' + medal + '</div>',
                    '<div style="flex:1;min-width:120px;">',
                    '<div style="font-weight:700;color:#fff;font-size:.95rem;">' + escapeHtml(e.name) + fakeTag + '</div>',
                    '<div style="font-size:.75rem;color:#666;margin-top:2px;">' + e.wins + 'W &nbsp; ' + e.losses + 'L &nbsp; <span style="color:' + (e.wr >= 50 ? '#00ff88' : '#ff4466') + ';">' + e.wr + '% WR</span></div>',
                    '</div>',
                    '<div style="display:flex;gap:4px;align-items:center;">' + (charImgs || '<span style="color:#444;font-size:.75rem;">Sin datos</span>') + '</div>',
                    '</div>'
                ].join('');
            });
            container.innerHTML = rows.join('');
        }

        function getTopChars(charUsage, n) {
            if (!charUsage) return [];
            return Object.entries(charUsage)
                .sort(function(a, b) { return b[1] - a[1]; })
                .slice(0, n)
                .map(function(e) { return e[0]; });
        }

        function getCharPortrait(charName) {
            // Re-use init-render portrait logic
            const portraits = {
                'Thestalos': 'https://i.postimg.cc/7hvFBnhX/Thestalos-portrait.jpg',
                'Sun Jin Woo': 'https://i.postimg.cc/pTFWmZwb/sun-jin-woo-portrait.jpg',
                'Gilgamesh': 'https://i.postimg.cc/W4k14Jrt/gilgamesh-portrait.jpg',
                'Madara Uchiha': 'https://i.postimg.cc/xjBhCb1Y/madara-portrait.jpg',
                'Goku': 'https://i.postimg.cc/Y0mS0LbP/goku-portrait.jpg',
                'Saitama': 'https://i.postimg.cc/Nfx2HQSQ/saitama-portrait.jpg',
                'Minato Namikaze': 'https://i.postimg.cc/fLHrnpGb/minato-portrait.jpg',
                'Tamayo': 'https://i.postimg.cc/GpHCWmdM/tamayo-portrait.jpg',
                'Muzan Kibutsuji': 'https://i.postimg.cc/sfvKTfMJ/muzan-portrait.jpg',
                'Darth Vader': 'https://i.postimg.cc/Kzm0KKMP/vader-portrait.jpg',
                'Ymir': 'https://i.postimg.cc/QdqNXynk/ymir-portrait.jpg',
                'Padme Amidala': 'https://i.postimg.cc/ydspL4rT/padme-portrait.jpg',
                'Daenerys Targaryen': 'https://i.postimg.cc/cJSdCVhp/daenerys-portrait.jpg',
                'Gandalf': 'https://i.postimg.cc/QCdstGDS/gandalf-portrait.jpg',
                'Sauron': 'https://i.postimg.cc/yx50rMbw/sauron-portrait.jpg',
                'Lich King': 'https://i.postimg.cc/MTn7Twbq/lichking-portrait.jpg',
                'Ragnar Lothbrok': 'https://i.postimg.cc/W4g0XZG7/ragnar-portrait.jpg',
                'Anakin Skywalker': 'https://i.postimg.cc/Nf5g6zzJ/anakin-portrait.jpg',
                'Palpatine': 'https://i.postimg.cc/hGMpD9Fz/palpatine-portrait.jpg',
                'Min Byung Gu': 'https://i.postimg.cc/PqsjrPtY/minbyung-portrait.jpg',
                'Aspros de Gemini': 'https://i.postimg.cc/Px6BdfJv/aspros-portrait.jpg',
                'Alexstrasza': 'https://i.postimg.cc/qMcyqQqL/alexstrasza-portrait.jpg',
                'Aldebaran': 'https://i.postimg.cc/6pyGkMXN/aldebaran-portrait.jpg',
                'Tirion Fordring': 'https://i.postimg.cc/FHRb4rMs/tirion-portrait.jpg',
                'Sindragosa': 'https://i.postimg.cc/Yq1BMLhz/sindragosa-portrait.jpg',
                'Naruto Uzumaki': 'https://i.postimg.cc/6pgC6gVb/naruto-portrait.jpg',
                'Doomsday': 'https://i.postimg.cc/T15Wbpxt/doomsday-portrait.jpg',
                'Nakime': 'https://i.postimg.cc/mgHWpvsq/nakime-portrait.jpg',
            };
            return portraits[charName] || 'https://i.postimg.cc/Px6BdfJv/aspros-portrait.jpg';
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


        // ── REVANCHA ONLINE ──
        let revanchaListener = null;
        function listenForRevanchaRequest(roomId) {
            // Turn off any previous listener
            if (revanchaListener) {
                db.ref(revanchaListener).off('value');
                revanchaListener = null;
            }
            const revRef = 'rooms/' + roomId + '/revancha';
            revanchaListener = revRef;
            db.ref(revRef).on('value', function(snap) {
                const data = snap.val();
                if (!data || !data.fromUid) return;
                // If I'm the one who sent it, ignore
                if (currentUser && data.fromUid === currentUser.uid) return;
                if (data.status !== 'pending') return;

                // Show revancha notification modal to the OTHER player
                showRevanchaModal(data.fromName || 'Tu rival', roomId);
            });
        }

        function showRevanchaModal(fromName, roomId) {
            let modal = document.getElementById('revanchaRequestModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'revanchaRequestModal';
                modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;';
                modal.innerHTML = [
                    '<div style="background:linear-gradient(135deg,#0a0e17,#0d1525);border:2px solid #aa00ff;border-radius:20px;padding:2rem 2.5rem;text-align:center;max-width:360px;box-shadow:0 0 40px rgba(170,0,255,0.4);">',
                    '<div style="font-size:2rem;margin-bottom:.5rem;">🔄</div>',
                    '<div style="font-family:Orbitron,sans-serif;font-size:1rem;color:#aa00ff;margin-bottom:.5rem;">¡REVANCHA!</div>',
                    '<div id="revanchaModalText" style="color:#ccc;font-size:.9rem;margin-bottom:1.5rem;"></div>',
                    '<div style="display:flex;gap:1rem;justify-content:center;">',
                    '<button onclick="respondRevancha(true)" style="background:linear-gradient(135deg,#003a1a,#00aa55);border:2px solid #00ff88;color:#00ff88;font-family:Orbitron,sans-serif;font-size:.85rem;padding:10px 24px;border-radius:10px;cursor:pointer;">✅ Aceptar</button>',
                    '<button onclick="respondRevancha(false)" style="background:rgba(255,51,102,0.15);border:2px solid #ff3366;color:#ff3366;font-family:Orbitron,sans-serif;font-size:.85rem;padding:10px 24px;border-radius:10px;cursor:pointer;">❌ Rechazar</button>',
                    '</div></div>'
                ].join('');
                document.body.appendChild(modal);
            }
            const txt = document.getElementById('revanchaModalText');
            if (txt) txt.textContent = (fromName || 'Tu rival') + ' quiere una revancha. ¿Aceptas?';
            modal.style.display = 'flex';
        }

        function respondRevancha(accept) {
            const modal = document.getElementById('revanchaRequestModal');
            if (modal) modal.style.display = 'none';
            if (!currentRoomId) return;
            if (accept) {
                db.ref('rooms/' + currentRoomId + '/revancha/status').set('accepted');
                // Also reinit from this side
                setTimeout(function() {
                    db.ref('rooms/' + currentRoomId + '/revancha').remove();
                    db.ref('rooms/' + currentRoomId + '/gameState').remove();
                    db.ref('rooms/' + currentRoomId + '/selections').remove();
                    db.ref('rooms/' + currentRoomId + '/status').set('waiting');
                    startOnlineGame(currentRoomId, isRoomHost);
                }, 500);
            } else {
                db.ref('rooms/' + currentRoomId + '/revancha/status').set('rejected');
                // Both go to lobby
                setTimeout(function() {
                    if (revanchaListener) { db.ref(revanchaListener).off(); revanchaListener = null; }
                    goToMainMenu();
                }, 500);
            }
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
            listenForRevanchaRequest(roomId);

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
