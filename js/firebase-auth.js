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
                // Only show lobby if no game, mode select, or char select is active
                var _gc = document.querySelector('.game-container');
                var _cs = document.getElementById('charSelectScreen');
                var _ms = document.getElementById('modeSelectScreen');
                var _gameActive = _gc && _gc.style.display === 'block';
                var _csActive = _cs && _cs.style.display !== 'none';
                var _msActive = _ms && _ms.style.display !== 'none';
                if (!_gameActive && !_csActive && !_msActive) {
                    showLobby();
                }
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
            // Never override an active game, mode select, or char select screen
            var gc = document.querySelector('.game-container');
            var charScreen = document.getElementById('charSelectScreen');
            var modeScreen = document.getElementById('modeSelectScreen');
            if (gc && gc.style.display === 'block') return; // game running
            if (charScreen && charScreen.style.display !== 'none') return; // char select open
            if (modeScreen && modeScreen.style.display !== 'none') return; // mode select open
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

            // Check and show ranked defense notifications
            listenForDefenseNotifications();

            // Check 30-day leaderboard reset
            checkLeaderboardReset();

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


        // ════════════════════════════════════════════════
        // EQUIPO RANKED — Selección y guardado de equipos
        // ════════════════════════════════════════════════
        let rtPickingTeam = 'attack'; // 'attack' | 'defense'
        let rtPickingSlot = -1;
        let rtAttackTeam = [];   // up to 5 char names
        let rtDefenseTeam = [];  // up to 5 char names

        function showRankedTeamScreen() {
            if (!currentUser) return;
            // Load saved teams from Firebase
            db.ref('ranked_teams/' + currentUser.uid).once('value', function(snap) {
                const data = snap.val() || {};
                rtAttackTeam  = (data.attack  || []).slice();
                rtDefenseTeam = (data.defense || []).slice();
                document.getElementById('rankedTeamScreen').style.display = 'block';
                rtRender();
            });
        }

        function hideRankedTeamScreen() {
            document.getElementById('rankedTeamScreen').style.display = 'none';
        }

        function rtRender() {
            rtRenderSlots('attack',  'rtAttackSlots',  rtAttackTeam,  '#4fc3f7');
            rtRenderSlots('defense', 'rtDefenseSlots', rtDefenseTeam, '#c864ff');
            rtRenderGrid();
        }

        function rtRenderSlots(teamType, containerId, team, color) {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = '';
            for (let i = 0; i < 5; i++) {
                const slot = document.createElement('div');
                const isActive = (rtPickingTeam === teamType && rtPickingSlot === i);
                const charName = team[i];
                slot.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;cursor:pointer;transition:all .15s;border:2px solid ' +
                    (isActive ? color : (charName ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)')) + ';background:' +
                    (isActive ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.3)') + ';';

                if (charName) {
                    const portrait = getCharPortrait(charName);
                    slot.innerHTML = [
                        '<img src="' + portrait + '" style="width:40px;height:40px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,0.2);" referrerpolicy="no-referrer">',
                        '<span style="flex:1;font-size:.9rem;color:#fff;font-weight:600;">' + escapeHtml(charName) + '</span>',
                        '<button onclick="rtRemoveChar(\'' + teamType + '\',' + i + ');event.stopPropagation();" ' +
                          'style="background:rgba(255,51,102,0.2);border:1px solid #ff3366;color:#ff3366;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:.75rem;">✕</button>'
                    ].join('');
                } else {
                    slot.innerHTML = '<span style="color:#444;font-size:.85rem;">+ Slot ' + (i+1) + ' (vacío)</span>';
                }

                slot.onclick = function() { rtSelectSlot(teamType, i); };
                container.appendChild(slot);
            }
        }

        function rtRenderGrid() {
            const grid = document.getElementById('rtCharGrid');
            if (!grid || typeof characterData === 'undefined') return;
            grid.innerHTML = '';
            const usedAttack  = new Set(rtAttackTeam.filter(Boolean));
            const usedDefense = new Set(rtDefenseTeam.filter(Boolean));
            const allUsed = new Set([...usedAttack, ...usedDefense]);

            Object.keys(characterData).forEach(function(name) {
                const cd = characterData[name];
                if (!cd || !cd.abilities) return;
                const inAttack  = usedAttack.has(name);
                const inDefense = usedDefense.has(name);
                const blocked   = allUsed.has(name);
                const portrait  = getCharPortrait(name);
                const card = document.createElement('div');
                card.style.cssText = 'position:relative;border-radius:10px;overflow:hidden;cursor:' + (blocked ? 'not-allowed' : 'pointer') +
                    ';opacity:' + (blocked ? '0.35' : '1') + ';transition:all .15s;border:2px solid ' +
                    (inAttack ? '#4fc3f7' : inDefense ? '#c864ff' : 'rgba(255,255,255,0.1)') + ';';
                card.innerHTML = [
                    '<img src="' + portrait + '" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;" referrerpolicy="no-referrer">',
                    '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.75);padding:3px 4px;font-size:.6rem;color:#ccc;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(name.split(' ')[0]) + '</div>',
                    inAttack  ? '<div style="position:absolute;top:3px;right:3px;background:#4fc3f7;color:#000;border-radius:4px;padding:1px 4px;font-size:.55rem;font-weight:700;">ATK</div>' : '',
                    inDefense ? '<div style="position:absolute;top:3px;left:3px;background:#c864ff;color:#000;border-radius:4px;padding:1px 4px;font-size:.55rem;font-weight:700;">DEF</div>' : '',
                ].join('');
                if (!blocked) {
                    card.onmouseover = function() { this.style.transform = 'scale(1.06)'; };
                    card.onmouseout  = function() { this.style.transform = 'scale(1)'; };
                    card.onclick = function() { rtPickChar(name); };
                }
                grid.appendChild(card);
            });
            // Update picking label
            const lbl = document.getElementById('rtPickingFor');
            if (lbl) {
                if (rtPickingSlot >= 0) {
                    lbl.textContent = (rtPickingTeam === 'attack' ? '🗡️ Equipo de Ataque' : '🛡️ Equipo de Defensa') + ' — Slot ' + (rtPickingSlot + 1);
                    lbl.style.color = rtPickingTeam === 'attack' ? '#4fc3f7' : '#c864ff';
                } else {
                    lbl.textContent = 'Haz clic en un slot vacío o ocupado para reemplazarlo';
                    lbl.style.color = '#666';
                }
            }
        }

        function rtSelectSlot(teamType, slotIdx) {
            rtPickingTeam = teamType;
            rtPickingSlot = slotIdx;
            rtRender();
        }

        function rtRemoveChar(teamType, slotIdx) {
            if (teamType === 'attack')  rtAttackTeam[slotIdx]  = null;
            if (teamType === 'defense') rtDefenseTeam[slotIdx] = null;
            // Compact (remove nulls but keep length by shifting)
            if (teamType === 'attack')  rtAttackTeam  = rtCompact(rtAttackTeam);
            if (teamType === 'defense') rtDefenseTeam = rtCompact(rtDefenseTeam);
            rtPickingSlot = -1;
            rtRender();
        }

        function rtCompact(arr) {
            const filled = arr.filter(Boolean);
            while (filled.length < 5) filled.push(null);
            return filled;
        }

        function rtPickChar(name) {
            if (rtPickingSlot < 0) {
                // Auto-assign to first empty slot of current team
                const team = rtPickingTeam === 'attack' ? rtAttackTeam : rtDefenseTeam;
                const emptyIdx = team.findIndex(function(x) { return !x; });
                if (emptyIdx < 0) { alert('El equipo ya tiene 5 personajes. Elimina uno primero.'); return; }
                rtPickingSlot = emptyIdx;
            }
            if (rtPickingTeam === 'attack') {
                rtAttackTeam[rtPickingSlot]  = name;
            } else {
                rtDefenseTeam[rtPickingSlot] = name;
            }
            // Advance to next empty slot
            const currentTeam = rtPickingTeam === 'attack' ? rtAttackTeam : rtDefenseTeam;
            const nextEmpty = currentTeam.findIndex(function(x,i) { return !x && i > rtPickingSlot; });
            rtPickingSlot = nextEmpty >= 0 ? nextEmpty : -1;
            rtRender();
        }

        function saveRankedTeams() {
            if (!currentUser) return;
            const attack  = rtAttackTeam.filter(Boolean);
            const defense = rtDefenseTeam.filter(Boolean);
            if (attack.length < 5) { alert('El Equipo de Ataque necesita 5 personajes.'); return; }
            if (defense.length < 5) { alert('El Equipo de Defensa necesita 5 personajes.'); return; }
            const data = { attack: attack, defense: defense, uid: currentUser.uid, name: currentUser.displayName || 'Jugador', ts: Date.now() };
            db.ref('ranked_teams/' + currentUser.uid).set(data).then(function() {
                const msg = document.getElementById('rankedTeamSaveMsg');
                if (msg) { msg.textContent = '✅ Equipos guardados correctamente'; msg.style.display = 'block'; setTimeout(function() { msg.style.display = 'none'; }, 3000); }
            });
        }

        function getRankedTeams(callback) {
            if (!currentUser) { callback(null); return; }
            db.ref('ranked_teams/' + currentUser.uid).once('value', function(snap) {
                callback(snap.val());
            });
        }

        function hasRankedTeams(callback) {
            getRankedTeams(function(data) {
                callback(data && data.attack && data.attack.length >= 5 && data.defense && data.defense.length >= 5);
            });
        }

        function startRankedMatchmaking() {
            if (!currentUser) return;
            // Check if player has configured ranked teams
            hasRankedTeams(function(hasTeams) {
                if (!hasTeams) {
                    alert('⚠️ Debes configurar tu Equipo Ranked (Ataque y Defensa) antes de jugar en modo Ranked.\n\nHaz clic en "⚔️ EQUIPO RANKED" para configurarlo.');
                    return;
                }
                _startRankedSearch();
            });
        }

        function _startRankedSearch() {
            const myUid  = currentUser.uid;
            const myName = currentUser.displayName || 'Jugador';

            showRankedSearchModal();

            // Register in queue
            const queueRef = db.ref('ranked_queue/' + myUid);
            queueRef.set({ uid: myUid, name: myName, ts: Date.now() });
            queueRef.onDisconnect().remove();

            let matched = false;
            rankedMatchmakingListener = db.ref('ranked_queue').on('value', function(snap) {
                if (matched) return;
                const queue = snap.val() || {};
                const others = Object.entries(queue).filter(function(e) {
                    return e[0] !== myUid && !e[1].matchedRoomId;
                });
                if (others.length === 0) return;

                // Found a rival — Ataque vs Ataque
                const [opponentUid, opponentData] = others[0];
                const iAmHost = myUid < opponentUid;
                matched = true;
                clearRankedTimer();
                db.ref('ranked_queue/' + myUid).remove();
                db.ref('ranked_queue').off('value', rankedMatchmakingListener);

                if (iAmHost) {
                    const roomId = 'R_' + generateRoomCode();
                    db.ref('ranked_queue/' + opponentUid).update({ matchedRoomId: roomId, matchedBy: myUid });
                    currentRoomId = roomId; isRoomHost = true; onlineMode = true;
                    window._rankedMode = true;
                    window._rankedPlayerTeam = 'team1'; // host is always team1
                    // Use attack teams for both players
                    getRankedTeams(function(myTeams) {
                        db.ref('ranked_teams/' + opponentUid).once('value', function(snap2) {
                            const oppTeams = snap2.val() || {};
                            window._teamNames = { team1: myName, team2: opponentData.name || 'Rival' };
                            db.ref('rooms/' + roomId).set({
                                host: { uid: myUid, name: myName, photo: currentUser.photoURL || '' },
                                guest: { uid: opponentUid, name: opponentData.name || 'Rival' },
                                status: 'ready', ranked: true, created: Date.now(),
                                hostAttack: myTeams ? myTeams.attack : null,
                                guestAttack: oppTeams ? oppTeams.attack : null
                            }).then(function() {
                                hideRankedSearchModal();
                                window._rankedOpponentName = opponentData.name || 'Rival';
                                startOnlineGame(roomId, true);
                            });
                        });
                    });
                } else {
                    // Wait for matchedRoomId
                    db.ref('ranked_queue/' + myUid + '/matchedRoomId').on('value', function(s) {
                        const rid = s.val();
                        if (!rid) return;
                        db.ref('ranked_queue/' + myUid + '/matchedRoomId').off();
                        db.ref('ranked_queue/' + myUid).remove();
                        matched = true; clearRankedTimer();
                        hideRankedSearchModal();
                        currentRoomId = rid; isRoomHost = false; onlineMode = true;
                        window._rankedMode = true;
                        window._rankedPlayerTeam = 'team2'; // guest is always team2
                        window._rankedOpponentName = opponentData.name || 'Rival';
                        window._teamNames = { team1: opponentData.name || 'Rival', team2: myName };
                        // Update room with guest info AND their attack team
                        getRankedTeams(function(myTeams) {
                            db.ref('rooms/' + rid).update({
                                guest: { uid: myUid, name: myName, photo: currentUser.photoURL || '' },
                                guestAttack: myTeams ? myTeams.attack : [],
                                status: 'ready'
                            }).then(function() { startOnlineGame(rid, false); });
                        });
                    });
                }
            });

            // 10s timer: no rival → fight random player's defense team
            rankedMatchmakingTimer = setTimeout(function() {
                if (matched) return;
                matched = true;
                clearRankedTimer();
                if (rankedMatchmakingListener) { db.ref('ranked_queue').off('value', rankedMatchmakingListener); rankedMatchmakingListener = null; }
                db.ref('ranked_queue/' + myUid).remove();
                hideRankedSearchModal();
                _startRankedVsDefense();
            }, 10000);
        }

        function _startRankedVsDefense() {
            // Pick a random player's defense team (excluding self)
            db.ref('ranked_teams').once('value', function(snap) {
                const allTeams = snap.val() || {};
                const eligible = Object.entries(allTeams).filter(function(e) {
                    return e[0] !== currentUser.uid && e[1].defense && e[1].defense.length >= 5;
                });

                const myName = currentUser.displayName || 'Jugador';

                if (eligible.length === 0) {
                    // No defense teams available — fall back to random IA with random team
                    window._rankedMode = true;
                    window._rankedPlayerTeam = 'team1'; // player always attacks as team1 vs CPU
                    window._rankedFakeOpponent = 'CPU';
                    window._rankedDefenseOwnerUid = null;
                    window._teamNames = { team1: myName, team2: 'CPU' };
                    getRankedTeams(function(myTeams) {
                        _launchRankedVsIAWithTeam(myTeams ? myTeams.attack : null, null, 'CPU');
                    });
                    return;
                }

                // Pick a random eligible defense
                const [defOwnerUid, defData] = eligible[Math.floor(Math.random() * eligible.length)];
                const defOwnerName = defData.name || 'Rival';
                window._rankedMode = true;
                window._rankedPlayerTeam = 'team1'; // player always attacks as team1
                window._rankedFakeOpponent = defOwnerName;
                window._rankedDefenseOwnerUid = defOwnerUid;
                window._teamNames = { team1: myName, team2: defOwnerName };

                getRankedTeams(function(myTeams) {
                    _launchRankedVsIAWithTeam(myTeams ? myTeams.attack : null, defData.defense, defOwnerName);
                });
            });
        }

        function _launchRankedVsIAWithTeam(attackTeam, defenseTeam, opponentName) {
            const myName = currentUser ? (currentUser.displayName || 'Jugador') : 'Jugador';
            window._rankedMode = true;
            window._rankedPlayerTeam = 'team1'; // player always attacks as team1 in vs-IA ranked
            window._rankedFakeOpponent = opponentName;

            // Pre-load teams into csState so no character select screen is needed
            csState.team1 = attackTeam || [];
            csState.team2 = defenseTeam || [];
            csState.phase = 'done';
            csState.gameMode = 'solo';
            csState.pendingChar = null;

            if (csState.team1.length >= 5 && csState.team2.length >= 5) {
                // Skip char select — start directly
                // Hide all non-game screens
                ['charSelectScreen','lobbyScreen','waitingScreen','modeSelectScreen','rankedTeamScreen'].forEach(function(id) {
                    const el = document.getElementById(id); if (el) el.style.display = 'none';
                });
                document.querySelector('.game-container').style.display = 'block';
                // Build character map
                const selectedChars = {};
                const nameCount = {};
                const allSelected = csState.team1.map(function(n) { return { name: n, team: 'team1' }; })
                    .concat(csState.team2.map(function(n) { return { name: n, team: 'team2' }; }));
                allSelected.forEach(function(entry) {
                    const base = entry.name;
                    nameCount[base] = (nameCount[base] || 0) + 1;
                    const key = nameCount[base] > 1 ? base + ' v' + nameCount[base] : base;
                    if (!characterData[base]) return;
                    const charCopy = JSON.parse(JSON.stringify(characterData[base]));
                    charCopy.team = entry.team;
                    charCopy.baseName = base;
                    selectedChars[key] = charCopy;
                });
                initGame(selectedChars);
                window._teamNames = { team1: myName, team2: opponentName };
                gameState.gameMode = 'ranked';
                gameState.aiTeam = 'team2';
                const th1 = document.getElementById('teamHeader1'); if (th1) th1.textContent = '🔷 ' + myName;
                const th2 = document.getElementById('teamHeader2'); if (th2) th2.textContent = '🔶 ' + opponentName;
                const sh1 = document.getElementById('statusHeader1'); if (sh1) sh1.textContent = '🔷 ' + myName;
                const sh2 = document.getElementById('statusHeader2'); if (sh2) sh2.textContent = '🔶 ' + opponentName;
                addLog('🏆 RANKED: ' + myName + ' vs ' + opponentName + ' (equipo de defensa)', 'info');
                audioManager.playRandomBattle();
            } else {
                // Fallback: go to char select (team1 only if no attack team)
                showScreen('charSelectScreen');
                csInit();
            }
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
                document.body.appendChild(modal); // append FIRST so querySelector works
            }
            modal.innerHTML = [
                '<div style="background:linear-gradient(135deg,#0a0e17,#0d1525);border:2px solid #ffaa00;border-radius:20px;padding:2.5rem 3rem;text-align:center;max-width:380px;box-shadow:0 0 50px rgba(255,170,0,0.3);">',
                '<div style="font-size:2.5rem;margin-bottom:.8rem;">&#x1F50D;</div>',
                '<div style="font-family:Orbitron,sans-serif;font-size:1.1rem;color:#ffaa00;margin-bottom:.5rem;letter-spacing:.1em;">BUSCANDO RIVAL...</div>',
                '<div style="color:#888;font-size:.85rem;margin-bottom:1.5rem;">Conectando con otro jugador online</div>',
                '<div id="rankedTimerDisplay" style="font-family:Orbitron,sans-serif;font-size:2rem;color:#fff;margin-bottom:1.5rem;">10</div>',
                '<div style="width:100%;height:6px;background:rgba(255,170,0,0.2);border-radius:3px;overflow:hidden;">',
                '<div id="rankedTimerBar" style="height:100%;background:linear-gradient(90deg,#ffaa00,#ff6600);width:100%;border-radius:3px;transition:width 1s linear;"></div>',
                '</div>',
                '<button id="cancelRankedBtn" style="margin-top:1.5rem;background:rgba(255,51,102,0.15);border:1px solid #ff3366;color:#ff3366;border-radius:10px;padding:10px 24px;cursor:pointer;font-size:.85rem;">&#x274C; Cancelar</button>',
                '</div>'
            ].join('');
            modal.querySelector('#cancelRankedBtn').onclick = cancelRankedSearch;
            modal.style.display = 'flex';
            // Countdown animation
            let timeLeft = 10;
            const timerEl = modal.querySelector('#rankedTimerDisplay');
            const barEl = modal.querySelector('#rankedTimerBar');
            if (timerEl) timerEl.textContent = '10';
            if (barEl) { barEl.style.transition = 'none'; barEl.style.width = '100%'; }
            if (rankedSearchInterval) clearInterval(rankedSearchInterval);
            setTimeout(function() { if (barEl) barEl.style.transition = 'width 1s linear'; }, 50);
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
            const defOwnerUid = window._rankedDefenseOwnerUid || null;
            window._rankedDefenseOwnerUid = null;

            // ── Save MY stats (attack) ──
            const myRef = db.ref('ranked_stats/' + myUid);
            myRef.once('value', function(snap) {
                const cur = snap.val() || {};
                cur.name = myName;
                // Global wins = atkWins + defWins
                cur.atkWins   = (cur.atkWins   || 0) + (won ? 1 : 0);
                cur.atkLosses = (cur.atkLosses || 0) + (won ? 0 : 1);
                cur.defWins   = cur.defWins   || 0;
                cur.defLosses = cur.defLosses || 0;
                cur.globalWins = (cur.atkWins || 0) + (cur.defWins || 0);
                // Attack char usage
                cur.atkCharUsage = cur.atkCharUsage || {};
                (playerChars || []).forEach(function(c) { cur.atkCharUsage[c] = (cur.atkCharUsage[c] || 0) + 1; });
                // defCharUsage = los personajes del PROPIO equipo de defensa del jugador
                cur.defCharUsage = cur.defCharUsage || {};
                db.ref('ranked_teams/' + myUid).once('value', function(myTeamSnap) {
                    const myTeamData = myTeamSnap.val() || {};
                    const myDefTeam = (myTeamData.defense || []).filter(Boolean);
                    [...new Set(myDefTeam)].forEach(function(c) { cur.defCharUsage[c] = (cur.defCharUsage[c] || 0) + 1; });
                    myRef.set(cur);
                });
            });

            // ── Notify + update defense owner if vs real player's defense ──
            if (defOwnerUid) {
                const notifRef = db.ref('ranked_notifications/' + defOwnerUid).push();
                notifRef.set({
                    type: 'defense_attacked', attackerName: myName, attackerUid: myUid,
                    defenseWon: !won, ts: Date.now(), read: false
                });
                const oppRef = db.ref('ranked_stats/' + defOwnerUid);
                oppRef.once('value', function(snap) {
                    const cur = snap.val() || {};
                    // Preserve or set name from ranked_teams data
                    if (!cur.name || cur.name === defOwnerUid) {
                        // Try to get the name from ranked_teams
                        db.ref('ranked_teams/' + defOwnerUid).once('value', function(teamSnap) {
                            const teamData = teamSnap.val() || {};
                            cur.name = teamData.name || fakeOpp || cur.name || defOwnerUid;
                            cur.defWins   = (cur.defWins   || 0) + (!won ? 1 : 0);
                            cur.defLosses = (cur.defLosses || 0) + (won  ? 1 : 0);
                            cur.atkWins   = cur.atkWins   || 0;
                            cur.atkLosses = cur.atkLosses || 0;
                            cur.globalWins = (cur.atkWins || 0) + (cur.defWins || 0);
                            // defCharUsage = los personajes del EQUIPO DE DEFENSA del defOwner
                            cur.defCharUsage = cur.defCharUsage || {};
                            const defTeam = (teamData.defense || []).filter(Boolean);
                            [...new Set(defTeam)].forEach(function(c) { cur.defCharUsage[c] = (cur.defCharUsage[c] || 0) + 1; });
                            oppRef.set(cur);
                        });
                    } else {
                        cur.defWins   = (cur.defWins   || 0) + (!won ? 1 : 0);
                        cur.defLosses = (cur.defLosses || 0) + (won  ? 1 : 0);
                        cur.atkWins   = cur.atkWins   || 0;
                        cur.atkLosses = cur.atkLosses || 0;
                        cur.globalWins = (cur.atkWins || 0) + (cur.defWins || 0);
                        // defCharUsage = los personajes del EQUIPO DE DEFENSA del defOwner
                        cur.defCharUsage = cur.defCharUsage || {};
                        db.ref('ranked_teams/' + defOwnerUid).once('value', function(tSnap2) {
                            const tData2 = tSnap2.val() || {};
                            const defTeam2 = (tData2.defense || []).filter(Boolean);
                            [...new Set(defTeam2)].forEach(function(c) { cur.defCharUsage[c] = (cur.defCharUsage[c] || 0) + 1; });
                            oppRef.set(cur);
                        });
                    }
                });
            }

            // ── Save fake opponent stats if vs CPU defense ──
            if (!defOwnerUid && fakeOpp && fakeOpp !== 'CPU') {
                const oppKey = 'fake_' + fakeOpp.replace(/[^a-zA-Z0-9]/g, '_');
                const oppRef = db.ref('ranked_stats/' + oppKey);
                oppRef.once('value', function(snap) {
                    const cur = snap.val() || { name: fakeOpp, isFake: true };
                    cur.defWins   = (cur.defWins   || 0) + (!won ? 1 : 0);
                    cur.defLosses = (cur.defLosses || 0) + (won  ? 1 : 0);
                    cur.atkWins   = cur.atkWins   || 0;
                    cur.atkLosses = cur.atkLosses || 0;
                    cur.globalWins = (cur.atkWins || 0) + (cur.defWins || 0);
                    cur.defCharUsage = cur.defCharUsage || {};
                    (opponentChars || []).forEach(function(c) { cur.defCharUsage[c] = (cur.defCharUsage[c] || 0) + 1; });
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
                document.body.appendChild(modal); // append FIRST
                modal.innerHTML = [
                    '<div style="width:100%;max-width:900px;background:linear-gradient(135deg,#0a0e17,#0d1525);border:2px solid #ffaa00;border-radius:20px;padding:28px;box-shadow:0 0 60px rgba(255,170,0,0.2);">',
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;border-bottom:1px solid rgba(255,170,0,0.15);padding-bottom:18px;">',
                    '<div>',
                        '<div style="font-family:Orbitron,sans-serif;font-size:1.4rem;font-weight:900;color:#ffaa00;text-shadow:0 0 20px rgba(255,170,0,0.6);letter-spacing:.08em;">&#x1F3C6; RANKED LEADERBOARD</div>',
                        '<div style="font-size:.75rem;color:#555;margin-top:4px;letter-spacing:.05em;">Estadísticas globales · Solo partidas Ranked</div>',
                    '</div>',
                    '<button id="leaderboardCloseBtn" style="background:rgba(255,68,102,0.2);border:2px solid #ff4466;color:#ff4466;font-size:1.1rem;width:38px;height:38px;border-radius:50%;cursor:pointer;">&#x2715;</button>',
                    '</div>',
                    '<div id="leaderboardContent" style="color:#888;text-align:center;padding:3rem;font-size:.9rem;">Cargando estadísticas...</div>',
                    '</div>'
                ].join('');
                modal.querySelector('#leaderboardCloseBtn').onclick = function() {
                    modal.style.display = 'none';
                };
            }
            modal.style.display = 'flex';
            loadLeaderboardData();
        }

        function loadLeaderboardData() {
            db.ref('ranked_stats').once('value', function(snap) {
                const data = snap.val() || {};
                const entries = Object.entries(data).map(function([key, v]) {
                    const atkW = v.atkWins   || v.wins   || 0;  // backwards compat
                    const atkL = v.atkLosses || v.losses || 0;
                    const defW = v.defWins   || 0;
                    const defL = v.defLosses || 0;
                    const globalW = atkW + defW;
                    const totalAtk = atkW + atkL;
                    const totalDef = defW + defL;
                    const totalAll = totalAtk + totalDef;
                    const globalWR = totalAll > 0 ? Math.round((globalW / totalAll) * 100) : 0;
                    return {
                        key, name: v.name || key, isFake: v.isFake || false,
                        atkWins: atkW, atkLosses: atkL,
                        defWins: defW, defLosses: defL,
                        globalWins: globalW, globalWR,
                        atkCharUsage: v.atkCharUsage || v.charUsage || {},
                        defCharUsage: v.defCharUsage || {}
                    };
                });
                // Sort by globalWins desc
                entries.sort(function(a, b) { return b.globalWins - a.globalWins || b.globalWR - a.globalWR; });
                renderLeaderboard(entries);
            });
        }

        function renderLeaderboard(entries) {
            const container = document.getElementById('leaderboardContent');
            if (!container) return;
            if (!entries.length) {
                container.innerHTML = '<div style="color:#555;text-align:center;padding:3rem;font-size:1rem;">Aún no hay partidas Ranked jugadas.<br><span style="color:#444;font-size:.85rem;">¡Sé el primero en jugar!</span></div>';
                return;
            }
            const rows = entries.map(function(e, i) {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '<span style="font-family:Orbitron,sans-serif;font-size:.85rem;color:#666;">' + (i + 1) + '</span>';
                const rankColor = i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#555';
                const bgGlow = i === 0 ? 'rgba(255,215,0,0.07)' : i === 1 ? 'rgba(192,192,192,0.04)' : i === 2 ? 'rgba(205,127,50,0.04)' : 'rgba(255,170,0,0.02)';
                const borderColor = i === 0 ? 'rgba(255,215,0,0.3)' : i === 1 ? 'rgba(192,192,192,0.15)' : i === 2 ? 'rgba(205,127,50,0.15)' : 'rgba(255,170,0,0.08)';
                const fakeTag = e.isFake ? '<span style="font-size:.58rem;color:#777;background:rgba(255,255,255,0.05);border:1px solid #444;border-radius:4px;padding:1px 5px;margin-left:6px;vertical-align:middle;">IA</span>' : '';
                const wrColor = e.globalWR >= 60 ? '#00ff88' : e.globalWR >= 40 ? '#ffaa00' : '#ff4466';

                // Top 5 attack chars
                const topAtk = getTopChars(e.atkCharUsage, 5);
                const atkImgs = topAtk.map(function(c) {
                    return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
                        '<img src="' + getCharPortrait(c) + '" title="' + escapeHtml(c) + '" referrerpolicy="no-referrer" ' +
                        'style="width:46px;height:46px;border-radius:7px;border:2px solid rgba(79,195,247,0.4);object-fit:cover;background:#111;" onerror="this.style.opacity=0.15">' +
                        '<span style="font-size:.5rem;color:#4fc3f7;max-width:46px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(c.split(' ')[0]) + '</span>' +
                        '</div>';
                }).join('');

                // Top 5 defense chars
                const topDef = getTopChars(e.defCharUsage, 5);
                const defImgs = topDef.map(function(c) {
                    return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
                        '<img src="' + getCharPortrait(c) + '" title="' + escapeHtml(c) + '" referrerpolicy="no-referrer" ' +
                        'style="width:46px;height:46px;border-radius:7px;border:2px solid rgba(200,100,255,0.4);object-fit:cover;background:#111;" onerror="this.style.opacity=0.15">' +
                        '<span style="font-size:.5rem;color:#c864ff;max-width:46px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(c.split(' ')[0]) + '</span>' +
                        '</div>';
                }).join('');

                const atkTotal = e.atkWins + e.atkLosses;
                const defTotal = e.defWins + e.defLosses;
                const atkWR = atkTotal > 0 ? Math.round((e.atkWins / atkTotal) * 100) : 0;
                const defWR = defTotal > 0 ? Math.round((e.defWins / defTotal) * 100) : 0;

                return [
                    '<div style="background:' + bgGlow + ';border:1px solid ' + borderColor + ';border-radius:14px;padding:16px 18px;margin-bottom:10px;">',
                    // Row 1: rank + name + global stats
                    '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:12px;">',
                        '<div style="font-size:1.5rem;min-width:34px;text-align:center;">' + medal + '</div>',
                        '<div style="flex:1;min-width:140px;">',
                            '<div style="font-family:Orbitron,sans-serif;font-weight:700;color:#fff;font-size:.95rem;">' + escapeHtml(e.name) + fakeTag + '</div>',
                            '<div style="font-size:.75rem;color:#888;margin-top:3px;">',
                                '🌐 <span style="color:#ffaa00;font-weight:700;">' + e.globalWins + '</span> Wins Globales &nbsp;',
                                '<span style="color:' + wrColor + ';font-weight:700;background:rgba(255,255,255,0.05);border-radius:5px;padding:1px 6px;">' + e.globalWR + '% WR</span>',
                            '</div>',
                        '</div>',
                        // Attack stats box
                        '<div style="background:rgba(79,195,247,0.07);border:1px solid rgba(79,195,247,0.2);border-radius:8px;padding:8px 12px;text-align:center;min-width:110px;">',
                            '<div style="font-size:.65rem;color:#4fc3f7;letter-spacing:.05em;margin-bottom:4px;">🗡️ ATAQUE</div>',
                            '<div style="font-size:.85rem;"><span style="color:#00ff88;font-weight:700;">' + e.atkWins + 'W</span> <span style="color:#555;">/</span> <span style="color:#ff4466;font-weight:700;">' + e.atkLosses + 'L</span></div>',
                            '<div style="font-size:.68rem;color:' + (atkWR>=50?'#00ff88':'#ff4466') + ';margin-top:2px;">' + atkWR + '% WR</div>',
                        '</div>',
                        // Defense stats box
                        '<div style="background:rgba(200,100,255,0.07);border:1px solid rgba(200,100,255,0.2);border-radius:8px;padding:8px 12px;text-align:center;min-width:110px;">',
                            '<div style="font-size:.65rem;color:#c864ff;letter-spacing:.05em;margin-bottom:4px;">🛡️ DEFENSA</div>',
                            '<div style="font-size:.85rem;"><span style="color:#00ff88;font-weight:700;">' + e.defWins + 'W</span> <span style="color:#555;">/</span> <span style="color:#ff4466;font-weight:700;">' + e.defLosses + 'L</span></div>',
                            '<div style="font-size:.68rem;color:' + (defWR>=50?'#00ff88':'#ff4466') + ';margin-top:2px;">' + defWR + '% WR</div>',
                        '</div>',
                    '</div>',
                    // Row 2: character images
                    '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">',
                        topAtk.length ? '<div><div style="font-size:.62rem;color:#4fc3f7;margin-bottom:6px;letter-spacing:.05em;">🗡️ MÁS USADOS ATAQUE</div><div style="display:flex;gap:5px;">' + atkImgs + '</div></div>' : '',
                        topDef.length ? '<div><div style="font-size:.62rem;color:#c864ff;margin-bottom:6px;letter-spacing:.05em;">🛡️ MÁS USADOS DEFENSA</div><div style="display:flex;gap:5px;">' + defImgs + '</div></div>' : '',
                    '</div>',
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
            // Use actual portrait URLs from characters.js
            if (typeof characterData !== 'undefined' && characterData[charName] && characterData[charName].portrait) {
                return characterData[charName].portrait;
            }
            // Fallback map with correct URLs
            const portraits = {
                'Madara Uchiha':        'https://i.postimg.cc/KzWJPy5j/Captura_de_pantalla_2026_02_26_134301.png',
                'Sun Jin Woo':          'https://i.postimg.cc/3rSZSvdF/Captura_de_pantalla_2026_03_11_105214.png',
                'Aldebaran':            'https://i.postimg.cc/PJr0LB6N/Captura_de_pantalla_2026_02_21_230603.png',
                'Leonidas':             'https://i.postimg.cc/TYJdgC3L/Captura_de_pantalla_2026_03_06_001254.png',
                'Min Byung':            'https://i.postimg.cc/Y9xJCpxr/Captura_de_pantalla_2026_02_22_002441.png',
                'Rengoku':              'https://i.postimg.cc/wTWCgJY2/Captura_de_pantalla_2026_03_15_021343.png',
                'Aspros de Gemini':     'https://i.postimg.cc/NMZcBh8m/Captura_de_pantalla_2026_02_27_201323.png',
                'Ymir':                 'https://i.postimg.cc/D0PFfyFL/Captura_de_pantalla_2026_03_03_125024.png',
                'Thestalos':            'https://i.postimg.cc/9f6kNBpV/Gemini_Generated_Image_ac4u14ac4u14ac4u.png',
                'Alexstrasza':          'https://i.postimg.cc/V6F3kYFw/Captura_de_pantalla_2026_02_21_233329.png',
                'Anakin Skywalker':     'https://i.postimg.cc/7hYjCpBh/Captura_de_pantalla_2026_02_21_231859.png',
                'Goku':                 'https://i.postimg.cc/wMsFFbWT/Captura_de_pantalla_2026_02_26_132013.png',
                'Ragnar Lothbrok':      'https://i.postimg.cc/9XqFNYqW/Captura_de_pantalla_2026_03_11_234717.png',
                'Saitama':              'https://i.postimg.cc/Qtz0QrqV/Captura_de_pantalla_2026_02_26_132109.png',
                'Ozymandias':           'https://i.postimg.cc/6qGzz1Hp/Captura_de_pantalla_2026_02_26_131502.png',
                'Gilgamesh':            'https://i.postimg.cc/nzNJp8K7/Captura_de_pantalla_2026_02_27_201309.png',
                'Goku Black':           'https://i.postimg.cc/SsGwxyGp/Captura_de_pantalla_2026_02_22_014009.png',
                'Saga de Geminis':      'https://i.postimg.cc/wBvTDG7f/Captura_de_pantalla_2026_02_24_103109.png',
                'Minato Namikaze':      'https://i.postimg.cc/qvNv9NQN/Captura_de_pantalla_2026_03_11_215715.png',
                'Muzan Kibutsuji':      'https://i.postimg.cc/fL41fCgH/Captura_de_pantalla_2026_02_28_020016.png',
                'Nakime':               'https://i.postimg.cc/858xm4nX/Captura_de_pantalla_2026_02_28_020047.png',
                'Sauron':               'https://i.postimg.cc/858xm4n0/Captura_de_pantalla_2026_02_28_020119.png',
                'Darth Vader':          'https://i.postimg.cc/63sFfc1F/Captura_de_pantalla_2026_02_28_015421.png',
                'Lich King':            'https://i.postimg.cc/W3Rxw8ff/Captura_de_pantalla_2026_02_28_015847.png',
                'Padme Amidala':        'https://i.postimg.cc/pV63g1B4/Whats_App_Image_2026_03_05_at_9_39_15_AM.jpg',
                'Daenerys Targaryen':   'https://i.postimg.cc/Gm8k90V5/Whats_App_Image_2026_03_15_at_1_59_17_AM.jpg',
                'Tamayo':               'https://i.postimg.cc/9XnsvNBS/Whats_App_Image_2026_03_05_at_9_42_52_AM.jpg',
                'Emperador Palpatine':  'https://i.postimg.cc/DfMRtYcj/Whats_App_Image_2026_03_05_at_9_50_54_AM.jpg',
                'Gandalf':              'https://i.postimg.cc/1RjbLYHx/Whats_App_Image_2026_03_05_at_9_53_24_AM.jpg',
                'Doomsday':             'https://i.postimg.cc/hjJDWnn6/Captura_de_pantalla_2026_03_06_003242.png',
                'Ikki de Fenix':        'https://i.postimg.cc/LsX6jbnD/Captura_de_pantalla_2026_02_24_103509.png',
            };
            return portraits[charName] || portraits['Aldebaran'];
        }

                // ── Defense Attack Notifications ──
        function listenForDefenseNotifications() {
            if (!currentUser) return;
            db.ref('ranked_notifications/' + currentUser.uid)
              .orderByChild('read').equalTo(false)
              .on('child_added', function(snap) {
                const n = snap.val();
                if (!n) return;
                const defended = n.defenseWon ? '✅ tu equipo resistió el ataque' : '❌ tu equipo fue derrotado';
                showLobbyToast('🛡️ ' + (n.attackerName || 'Alguien') + ' atacó tu equipo de defensa — ' + defended);
                snap.ref.update({ read: true });
            });
        }

        function showLobbyToast(msg) {
            let toast = document.getElementById('lobbyToast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'lobbyToast';
                toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(10,14,23,0.95);border:1px solid #ffaa00;border-radius:12px;padding:14px 24px;color:#ffaa00;font-size:.88rem;z-index:9999;max-width:420px;text-align:center;box-shadow:0 0 24px rgba(255,170,0,0.3);transition:opacity .3s;';
                document.body.appendChild(toast);
            }
            toast.textContent = msg;
            toast.style.opacity = '1';
            clearTimeout(toast._hideTimer);
            toast._hideTimer = setTimeout(function() { toast.style.opacity = '0'; }, 5000);
        }

        // ── 30-day Leaderboard Reset ──
        const LEADERBOARD_RESET_DAYS = 30;
        function checkLeaderboardReset() {
            db.ref('leaderboard_meta/lastReset').once('value', function(snap) {
                const lastReset = snap.val() || 0;
                const now = Date.now();
                const daysSince = (now - lastReset) / (1000 * 60 * 60 * 24);
                if (daysSince >= LEADERBOARD_RESET_DAYS) {
                    // Reset all stats
                    db.ref('ranked_stats').remove().then(function() {
                        db.ref('leaderboard_meta/lastReset').set(now);
                        console.log('[RANKED] Leaderboard reset — new 30-day season started');
                    });
                }
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

            initChat(roomId);
            listenForRevanchaRequest(roomId);

            // Fetch room to check if ranked (skip char select) or normal online
            db.ref('rooms/' + roomId).once('value', function(snap) {
                const room = snap.val() || {};
                const hostName  = (room.host  && room.host.name)  ? room.host.name  : 'Jugador 1';
                const guestName = (room.guest && room.guest.name) ? room.guest.name : 'Jugador 2';
                window._teamNames = { team1: hostName, team2: guestName };

                // ── RANKED: skip char select, each player loads own attack team ──
                if (room.ranked) {
                    window._rankedMode = true;
                    window._rankedPlayerTeam = asHost ? 'team1' : 'team2';
                    window._rankedOpponentName = asHost ? guestName : hostName;
                    csState.gameMode   = 'online';
                    csState.onlineTeam = asHost ? 'team1' : 'team2';
                    csState.phase      = 'done';
                    csState.pendingChar = null;

                    const myTeam = asHost ? 'team1' : 'team2';

                    // Load MY own attack team from Firebase (avoids timing issues)
                    getRankedTeams(function(myData) {
                        const myAttack = (myData && myData.attack) ? myData.attack : [];
                        // Push my picks so opponent sees I'm ready
                        db.ref('rooms/' + roomId + '/selections').update({
                            [myTeam + '_picks'] : myAttack,
                            [myTeam + '_ready'] : true
                        });
                        _listenForRankedBothReady(roomId, asHost, hostName, guestName, myAttack);
                    });
                    return;
                }

                // ── NORMAL ONLINE: go to char select as before ──
                csState.team1 = [];
                csState.team2 = [];
                csState.phase = 'team1';
                csState.pendingChar = null;
                csState.gameMode = 'online';
                csState.onlineTeam = asHost ? 'team1' : 'team2';

                showScreen('charSelectScreen');

                const lbl = document.getElementById('csPhaseLabel');
                const myName2 = asHost ? hostName : guestName;
                if (asHost) {
                    if (lbl) { lbl.textContent = '🔷 ' + myName2 + ' — Elige tus 5 personajes'; lbl.className = 'cs-phase-label team1'; }
                } else {
                    if (lbl) { lbl.textContent = '🔶 ' + myName2 + ' — Elige tus 5 personajes'; lbl.className = 'cs-phase-label team2'; }
                }
                const n1 = document.getElementById('csTeamName1'); if (n1) n1.textContent = hostName;
                const n2 = document.getElementById('csTeamName2'); if (n2) n2.textContent = guestName;
                const h1 = document.getElementById('teamHeader1'); if (h1) h1.textContent = '🔷 ' + hostName;
                const h2 = document.getElementById('teamHeader2'); if (h2) h2.textContent = '🔶 ' + guestName;
                const sh1 = document.getElementById('statusHeader1'); if (sh1) sh1.textContent = '🔷 ' + hostName;
                const sh2 = document.getElementById('statusHeader2'); if (sh2) sh2.textContent = '🔶 ' + guestName;

                console.log('[OVERSTRIKE DEBUG] startOnlineGame: asHost=', asHost, '| onlineTeam=', csState.onlineTeam, '| gameMode=', csState.gameMode);
                csInit();
                listenForOnlineReady(roomId, csState.onlineTeam);
            });
        }

        function _listenForRankedBothReady(roomId, asHost, hostName, guestName, myAttack) {
            // Show connecting overlay
            let overlay = document.getElementById('rankedConnectOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'rankedConnectOverlay';
                overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
                overlay.innerHTML = [
                    '<div style="font-size:2.5rem;">⚔️</div>',
                    '<div style="font-family:Orbitron,sans-serif;font-size:1.1rem;color:#ffaa00;letter-spacing:.1em;">CONECTANDO CON RIVAL...</div>',
                    '<div style="font-size:.85rem;color:#666;">Cargando equipos Ranked</div>'
                ].join('');
                document.body.appendChild(overlay);
            }
            overlay.style.display = 'flex';

            const myTeam  = asHost ? 'team1' : 'team2';
            const oppTeam = asHost ? 'team2' : 'team1';

            // Poll for both sides ready
            db.ref('rooms/' + roomId + '/selections').on('value', function handler(snap) {
                const data = snap.val() || {};
                const myReady  = data[myTeam  + '_ready'];
                const oppReady = data[oppTeam + '_ready'];
                if (!myReady || !oppReady) return;

                // Both ready — get picks from Firebase
                const t1Picks = data['team1_picks'] || [];
                const t2Picks = data['team2_picks'] || [];

                // Stop listening
                db.ref('rooms/' + roomId + '/selections').off('value', handler);
                overlay.style.display = 'none';

                // Build character map
                const selectedChars = {};
                const nameCount = {};
                const allSelected = t1Picks.map(function(n) { return { name: n, team: 'team1' }; })
                    .concat(t2Picks.map(function(n) { return { name: n, team: 'team2' }; }));
                allSelected.forEach(function(entry) {
                    const base = entry.name;
                    nameCount[base] = (nameCount[base] || 0) + 1;
                    const key = nameCount[base] > 1 ? base + ' v' + nameCount[base] : base;
                    if (!characterData || !characterData[base]) return;
                    const charCopy = JSON.parse(JSON.stringify(characterData[base]));
                    charCopy.team = entry.team;
                    charCopy.baseName = base;
                    selectedChars[key] = charCopy;
                });

                // Hide any screens, show game
                document.getElementById('charSelectScreen').style.display = 'none';
                document.querySelector('.game-container').style.display = 'block';
                // Hide lobby/other screens
                ['lobbyScreen','waitingScreen','modeSelectScreen'].forEach(function(id) {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });

                initGame(selectedChars);
                gameState.gameMode = 'ranked';
                gameState.aiTeam   = null; // both humans
                window._teamNames  = { team1: hostName, team2: guestName };

                // Update team labels
                const th1 = document.getElementById('teamHeader1');  if (th1) th1.textContent = '🔷 ' + hostName;
                const th2 = document.getElementById('teamHeader2');  if (th2) th2.textContent = '🔶 ' + guestName;
                const sh1 = document.getElementById('statusHeader1'); if (sh1) sh1.textContent = '🔷 ' + hostName;
                const sh2 = document.getElementById('statusHeader2'); if (sh2) sh2.textContent = '🔶 ' + guestName;

                addLog('🏆 RANKED: ' + hostName + ' vs ' + guestName, 'info');
                audioManager.playRandomBattle();

                // Start sync
                setTimeout(function() {
                    if (isRoomHost) { pushGameState(); }
                    listenGameState();
                }, 500);
            });
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
