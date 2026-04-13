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

        // ── BACK BUTTON INJECTION ──────────────────────────────────────────
        // Adds "← Volver" buttons to screens that need them.
        // Called once on page load and whenever a screen is shown.
        function injectBackButtons() {
            // Screen definitions: { screenId, backLabel, backAction }
            var BACK_CONFIG = [
                {
                    id: 'charSelectScreen',
                    label: '← Volver al Lobby',
                    action: 'showLobby()',
                    existsCheck: function(el) {
                        return !!el.querySelector('#csBackBtn');
                    },
                    inject: function(el) {
                        var btn = document.createElement('button');
                        btn.id = 'csBackBtn';
                        btn.textContent = '← Volver al Lobby';
                        btn.setAttribute('onclick', "document.querySelector('.game-container') && (document.querySelector('.game-container').style.display = 'none'); showScreen('lobbyScreen'); showLobby();");
                        btn.style.cssText = [
                            'position:fixed',
                            'top:14px',
                            'left:14px',
                            'z-index:9999',
                            'background:rgba(0,0,0,0.55)',
                            'border:1.5px solid rgba(255,255,255,0.25)',
                            'color:#ccc',
                            'font-family:Orbitron,sans-serif',
                            'font-size:.72rem',
                            'letter-spacing:.06em',
                            'padding:8px 16px',
                            'border-radius:8px',
                            'cursor:pointer',
                            'transition:all .15s'
                        ].join(';');
                        btn.onmouseover = function() {
                            this.style.background = 'rgba(79,195,247,0.18)';
                            this.style.borderColor = '#4fc3f7';
                            this.style.color = '#4fc3f7';
                        };
                        btn.onmouseout = function() {
                            this.style.background = 'rgba(0,0,0,0.55)';
                            this.style.borderColor = 'rgba(255,255,255,0.25)';
                            this.style.color = '#ccc';
                        };
                        el.appendChild(btn);
                    }
                },
                {
                    id: 'modeSelectScreen',
                    existsCheck: function(el) {
                        // modeSelectScreen already has "← Volver al Lobby" as the first button
                        return true;
                    },
                    inject: function() {}
                },
                {
                    id: 'waitingScreen',
                    existsCheck: function(el) {
                        // waitingScreen already has "Cancelar" button
                        return true;
                    },
                    inject: function() {}
                }
            ];

            BACK_CONFIG.forEach(function(cfg) {
                var el = document.getElementById(cfg.id);
                if (!el) return;
                if (!cfg.existsCheck(el)) cfg.inject(el);
            });
        }

        // Run on page load
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(injectBackButtons, 500);
        });
        // Also run immediately in case DOM is already ready
        if (document.readyState !== 'loading') {
            setTimeout(injectBackButtons, 500);
        }


        // ══════════════════════════════════════════════════════════
        // BATTLE BACKGROUNDS — random image each game
        // ══════════════════════════════════════════════════════════
        var BATTLE_BACKGROUNDS = [
            'https://i.ibb.co/999Tq0YP/descarga-1.jpg',
            'https://i.ibb.co/1GRjfQpG/Dragon-Ball-Z-Revival-Of-F.jpg',
            'https://i.ibb.co/3yyY65nG/Instagram.jpg',
            'https://i.ibb.co/4nGmMLnc/descarga-2.jpg',
            'https://i.ibb.co/FL3JTCHd/descarga-3.jpg',
            'https://i.ibb.co/2Y6mk90J/Echoes-of-the-Ancestors.jpg',
            'https://i.ibb.co/S45SZcJw/descarga-4.jpg',
            'https://i.ibb.co/B2xcn8Wr/descarga-5.jpg',
            'https://i.ibb.co/0pYJ5ZQ8/descarga-7.jpg',
            'https://i.ibb.co/bx6SXjs/throneroom.jpg',
            'https://i.ibb.co/h1FLNK7V/Download-Free-Vectors-Images-Photos-Videos-Vecteezy.jpg',
            'https://i.ibb.co/RTqqRPtZ/Onde-tudo-come-ou-a-mudar-romancescifi-oguardiao-oguardiaoeaandroid-casavarlen-casavarlenunive.jpg',
            'https://i.ibb.co/Txt7q1bY/descarga-8.jpg',
            'https://i.ibb.co/n8wgwPQF/Background-Battles-LETTA.jpg',
            'https://i.ibb.co/60JZvczS/descarga-10.jpg',
            'https://i.ibb.co/N6mHjnbr/descarga-11.jpg',
            'https://i.ibb.co/pBQnkQdt/2014-BERSERKER-XUN.jpg',
            'https://i.ibb.co/tTC2GH3P/Pyra-Temple-Interior.jpg',
            'https://i.ibb.co/3YcWWy7T/Hell.jpg',
            'https://i.ibb.co/8nqwHY0K/descarga-12.jpg',
            'https://i.ibb.co/d4pZL9pP/B.jpg',
            'https://i.ibb.co/TDQ2D2hs/Mortal-Kombat-9-Arena.jpg',
            'https://i.ibb.co/Vcnvq19v/descarga-13.jpg',
            'https://i.ibb.co/YT8j6Pdx/Artist-Atents-Title-Unknown-Event-Unknown.jpg',
            'https://i.ibb.co/nMwTxfMT/nightcafestudio-presents-a-new-wave-of-Mortal-Kombat-related-Arenas-Scorpion-s-Lair-Hell-Goro-s.jpg',
            'https://i.ibb.co/tMsBvX8z/Mortal-Kombat-Dragon-Logo.jpg',
            'https://i.ibb.co/v4QVf2d7/Download-Free-Vectors-Images-Photos-Videos-Vecteezy-1.jpg',
            'https://i.ibb.co/Z6Rn196m/Halloween-wallpaper-Photos-Download-Free-High-Quality-Pictures-Freepik.jpg',
            'https://i.ibb.co/XfRr67Jr/descarga-15.jpg',
            'https://i.ibb.co/DgHyyMVJ/descarga-14.jpg',
            'https://i.ibb.co/9Hjv7qK8/94-Monster-Arena.jpg',
            'https://i.ibb.co/zV9Pdv8H/descarga.webp',
            'https://i.ibb.co/nqKhh3ph/descarga-16.jpg',
            'https://i.ibb.co/fVLJzKCf/Firefly-Grand-medieval-throne-room-with-vaulted-ceilings-tall-stained-glass-windows-and-a-r-768492-h.jpg',
            'https://i.ibb.co/chqF1cgx/descarga-17.jpg',
            'https://i.ibb.co/8nkyyhmx/descarga-18.jpg',
            'https://i.ibb.co/Y7HpkVRT/descarga-19.jpg',
            'https://i.ibb.co/KjVHhmmb/descarga-20.jpg',
            'https://i.ibb.co/Jw51jQ50/descarga-21.jpg',
            'https://i.ibb.co/JjFH68Wr/reino-volc-nico.jpg',
            'https://i.ibb.co/fGCKr6PC/image.jpg',
            'https://i.ibb.co/4nhWF9HC/descarga-22.jpg',
            'https://i.ibb.co/84QL6tB2/Art-Station-Lava-forge-silentfield.jpg',
            'https://i.ibb.co/1GnMzHJ2/environment.jpg',
            'https://i.ibb.co/991KdxM8/descarga-23.jpg',
            'https://i.ibb.co/W4Tm5TNz/descarga-24.jpg',
            'https://i.ibb.co/gZBst66Z/descarga-25.jpg',
            'https://i.ibb.co/JWVJchhh/descarga-26.jpg',
            'https://i.ibb.co/Q3BDLJX3/Tree-Brushes-Stamps.jpg',
            'https://i.ibb.co/8gYK0p6B/descarga-1.webp',
            'https://i.ibb.co/XxrpZXvH/Void-Gate.jpg',
            'https://i.ibb.co/ymWMRVz0/descarga-27.jpg',
            'https://i.ibb.co/8LxLkDJY/Ancient-Drake-Giulia-Gentilini.jpg',
            'https://i.ibb.co/Fk2htqDs/descarga-2.webp',
            'https://i.ibb.co/spdR7tt3/Demonic-Porta-Z.jpg'
        ];

        function applyBattleBackground() {
            var url = BATTLE_BACKGROUNDS[Math.floor(Math.random() * BATTLE_BACKGROUNDS.length)];
            // Fixed full-screen background div — sits above body bg, below all game UI
            var bg = document.getElementById('battle-bg-fullscreen');
            if (!bg) {
                bg = document.createElement('div');
                bg.id = 'battle-bg-fullscreen';
                document.body.insertBefore(bg, document.body.firstChild);
            }
            bg.style.cssText =
                'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
                'background-size:cover;background-position:center center;' +
                'background-repeat:no-repeat;' +
                'z-index:0;pointer-events:none;display:block;';
            bg.style.backgroundImage = 'url(' + url + ')';
            // Dark overlay for readability
            var overlay = document.getElementById('battle-bg-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'battle-bg-overlay';
                overlay.style.cssText =
                    'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
                    'background:rgba(5,8,16,0.52);' +
                    'z-index:1;pointer-events:none;display:block;';
                document.body.insertBefore(overlay, bg.nextSibling);
            } else {
                overlay.style.display = 'block';
            }
            // Make body and all screen containers transparent so bg shows through
            var style = document.getElementById('battle-bg-style');
            if (!style) {
                style = document.createElement('style');
                style.id = 'battle-bg-style';
                document.head.appendChild(style);
            }
            style.textContent =
                'body { background: transparent !important; }' +
                'html { background: transparent !important; }' +
                '#lobbyScreen,#modeSelectScreen,#charSelectScreen,#loginScreen,#waitingScreen,' +
                '.game-container,.battle-arena,.game-header {' +
                '  background: transparent !important;' +
                '  position: relative; z-index: 2;' +
                '}';
        }

        function clearBattleBackground() {
            var bg = document.getElementById('battle-bg-fullscreen');
            if (bg) { bg.style.backgroundImage = 'none'; bg.style.display = 'none'; }
            var overlay = document.getElementById('battle-bg-overlay');
            if (overlay) overlay.style.display = 'none';
            var style = document.getElementById('battle-bg-style');
            if (style) style.remove();
        }

        function showLobby() {
            clearBattleBackground();
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
                // Inject "Probar vs IA" button if not already present
                rtInjectTestButton();
            });
        }

        function rtInjectTestButton() {
            if (document.getElementById('rtTestVsIABtn')) return; // already injected
            // Find the save button container and add our button after it
            const screen = document.getElementById('rankedTeamScreen');
            if (!screen) return;
            // Find the GUARDAR button
            const saveBtn = screen.querySelector('button[onclick*="saveRankedTeams"]') ||
                Array.from(screen.querySelectorAll('button')).find(function(b) { return b.textContent.includes('GUARDAR'); });
            if (!saveBtn) return;
            const saveContainer = saveBtn.parentElement;
            // Create our button
            const testBtn = document.createElement('button');
            testBtn.id = 'rtTestVsIABtn';
            testBtn.onclick = rtTestVsIA;
            testBtn.innerHTML = '⚔️ PROBAR MIS EQUIPOS VS IA';
            testBtn.style.cssText = [
                'background: linear-gradient(135deg, #ff6b35, #ff3366)',
                'border: 2px solid #ff6b35',
                'color: #fff',
                'font-family: Orbitron, sans-serif',
                'font-size: .85rem',
                'font-weight: 700',
                'letter-spacing: .08em',
                'padding: 14px 28px',
                'border-radius: 12px',
                'cursor: pointer',
                'width: 100%',
                'margin-top: 10px',
                'text-shadow: 0 1px 3px rgba(0,0,0,.5)',
                'box-shadow: 0 0 20px rgba(255,107,53,.4)',
                'transition: all .2s'
            ].join(';');
            testBtn.onmouseover = function() { this.style.boxShadow = '0 0 30px rgba(255,107,53,.7)'; this.style.transform = 'scale(1.02)'; };
            testBtn.onmouseout  = function() { this.style.boxShadow = '0 0 20px rgba(255,107,53,.4)'; this.style.transform = 'scale(1)'; };
            // Insert after save container (or after save button)
            if (saveContainer && saveContainer !== screen) {
                saveContainer.parentElement.insertBefore(
                    Object.assign(document.createElement('div'), {
                        style: 'padding: 0 24px 8px;',
                        innerHTML: testBtn.outerHTML
                    }),
                    saveContainer.nextSibling
                );
                // Re-bind onclick after outerHTML loses it
                const injected = document.getElementById('rtTestVsIABtn');
                if (injected) injected.onclick = rtTestVsIA;
            } else {
                saveBtn.parentElement.appendChild(testBtn);
            }
            // Add helper tooltip
            const tip = document.createElement('div');
            tip.style.cssText = 'text-align:center;font-size:.75rem;color:#888;padding:4px 24px 12px;';
            tip.textContent = '⚔️ TÚ con tu Equipo de Ataque · 🛡️ IA con tu Equipo de Defensa';
            const injBtn = document.getElementById('rtTestVsIABtn');
            if (injBtn) injBtn.parentElement.appendChild(tip);
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


        function rtTestVsIA() {
            const attack  = rtAttackTeam.filter(Boolean);
            const defense = rtDefenseTeam.filter(Boolean);
            if (attack.length < 5)  { alert('⚠️ Configura 5 personajes en tu Equipo de Ataque primero.'); return; }
            if (defense.length < 5) { alert('⚠️ Configura 5 personajes en tu Equipo de Defensa primero.'); return; }
            const playerName = currentUser ? (currentUser.displayName || 'Jugador') : 'Jugador';
            // Mark this as a self-test — results must NOT be saved to the leaderboard
            window._rankedSelfTest = true;
            hideRankedTeamScreen();
            _launchRankedVsIAWithTeam(attack, defense, playerName + ' (Defensa — Prueba)');
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

        // ══════════════════════════════════════════════════════
        // SISTEMA RAID DIARIO
        // ══════════════════════════════════════════════════════

        function showRaidLobby() {
            if (!currentUser) return;
            hasRankedTeams(function(hasTeams) {
                if (!hasTeams) {
                    alert('⚠️ Configura tu Equipo Ranked antes de jugar.\nHaz clic en "⚔️ EQUIPO RANKED".');
                    return;
                }
                // Asegurar que el jugador tenga su nombre registrado en ranked_stats
                var uid  = currentUser.uid;
                var name = currentUser.displayName || 'Jugador';
                db.ref('ranked_stats/' + uid + '/name').once('value', function(nameSnap) {
                    if (!nameSnap.val()) {
                        db.ref('ranked_stats/' + uid + '/name').set(name);
                    }
                    _loadOrGenerateRaidTargets(function(raidData) {
                        _renderRaidLobby(raidData);
                    });
                });
            });
        }

        function _getTodayMidnightKey() {
            var d = new Date();
            return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        }

        function _loadOrGenerateRaidTargets(callback) {
            var uid = currentUser.uid;
            var todayKey = _getTodayMidnightKey();
            db.ref('ranked_stats/' + uid + '/raidToday').once('value', function(snap) {
                var raidData = snap.val() || {};
                // Si ya tenemos datos de hoy, devolverlos tal cual
                if (raidData.date === todayKey && raidData.targets && raidData.targets.length > 0) {
                    callback(raidData);
                    return;
                }
                // Generar nuevos objetivos para hoy
                _generateRaidTargets(uid, todayKey, callback);
            });
        }

        function _generateRaidTargets(uid, todayKey, callback) {
            db.ref('ranked_stats').once('value', function(snap) {
                var allStats = snap.val() || {};
                var myStats  = allStats[uid] || {};
                var myPoints = myStats.points || 0;
                var candidates = [];
                Object.keys(allStats).forEach(function(oUid) {
                    if (oUid === uid) return;
                    var oStat = allStats[oUid];
                    if (!oStat) return;
                    // Aceptar aunque no tenga nombre — usamos fallback
                    candidates.push({ uid: oUid, name: oStat.name || '', points: oStat.points || 0 });
                });
                // Verificar que tengan equipo de defensa y completar nombre si falta
                db.ref('ranked_teams').once('value', function(teamsSnap) {
                    var allTeams = teamsSnap.val() || {};
                    candidates = candidates.filter(function(c) {
                        var t = allTeams[c.uid];
                        if (!t || !t.defense || t.defense.filter(Boolean).length < 5) return false;
                        // Completar nombre desde ranked_teams si falta en ranked_stats
                        if (!c.name && t.name) c.name = t.name;
                        if (!c.name) c.name = 'Jugador';
                        return true;
                    });
                    candidates.sort(function(a, b) {
                        return Math.abs(a.points - myPoints) - Math.abs(b.points - myPoints);
                    });
                    var targets = candidates.slice(0, 5).map(function(c) {
                        return { uid: c.uid, name: c.name, points: c.points, attacked: false, result: null, pts: null };
                    });
                    var raidData = {
                        date: todayKey,
                        attacksLeft: 5,
                        targets: targets,
                        attackedTargets: []
                    };
                    db.ref('ranked_stats/' + uid + '/raidToday').set(raidData);
                    callback(raidData);
                });
            });
        }

        function _renderRaidLobby(raidData) {
            var existing = document.getElementById('raidLobbyModal');
            if (existing) existing.remove();

            var modal = document.createElement('div');
            modal.id = 'raidLobbyModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;';

            var targets = raidData.targets || [];
            var attacksLeft = raidData.attacksLeft !== undefined ? raidData.attacksLeft : 5;
            var attacksDone = 5 - attacksLeft;

            // Generar filas de objetivos
            var targetRows = targets.map(function(t) {
                var attacked = t.attacked || false;
                // Si el resultado es 'pending' (batalla no completada), tratar como no atacado
                // pero mantener el ataque consumido
                var hasResult = attacked && t.result && t.result !== 'pending';
                var resultLabel = '';
                var resultColor = '#888';
                var ptsLabel = '';
                if (hasResult) {
                    if (t.result === 'win')  { resultLabel = '✅ Victoria'; resultColor = '#00ff88'; }
                    if (t.result === 'loss') { resultLabel = '❌ Derrota';  resultColor = '#ff4466'; }
                    if (t.result === 'draw') { resultLabel = '🤝 Empate';   resultColor = '#ffaa00'; }
                    var pts = t.pts || 0;
                    ptsLabel = '<span style="color:' + (pts >= 0 ? '#00ff88' : '#ff4466') + ';font-weight:700;font-size:.85rem;">' + (pts >= 0 ? '+' : '') + pts + ' pts</span>';
                }
                var attackBtn = attacked
                    ? '<span style="color:#444;font-size:.75rem;">Ya atacado</span>'
                    : '<button onclick="raidAttackTarget(\'' + t.uid + '\',\'' + t.name.replace(/'/g,'') + '\')" style="background:linear-gradient(135deg,rgba(255,170,0,0.2),rgba(255,100,0,0.1));border:1px solid #ffaa00;color:#ffaa00;padding:7px 16px;border-radius:8px;cursor:pointer;font-family:Orbitron,sans-serif;font-size:.7rem;font-weight:700;letter-spacing:.05em;">ATACAR</button>';
                return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,' + (attacked ? '0.02' : '0.05') + ');border:1px solid rgba(255,255,255,' + (attacked ? '0.05' : '0.12') + ');opacity:' + (attacked ? '0.6' : '1') + ';">' +
                    '<div style="flex:1;">' +
                        '<div style="font-size:.9rem;font-weight:700;color:' + (attacked ? '#666' : '#fff') + ';">' + _escapeHtmlRaid(t.name) + '</div>' +
                        '<div style="font-size:.75rem;color:#888;margin-top:2px;">⭐ ' + (t.points || 0) + ' pts</div>' +
                    '</div>' +
                    (hasResult ? '<div style="text-align:right;"><div style="font-size:.75rem;color:' + resultColor + ';">' + resultLabel + '</div><div>' + ptsLabel + '</div></div>' : '') +
                    '<div>' + attackBtn + '</div>' +
                '</div>';
            }).join('');

            if (targets.length === 0) {
                targetRows = '<div style="text-align:center;color:#666;padding:24px;">No hay rivales disponibles por ahora.<br>Vuelve más tarde o usa "Buscar Rival".</div>';
            }

            // Íconos de ataques disponibles
            var attackIcons = '';
            for (var i = 0; i < 5; i++) {
                attackIcons += '<span style="font-size:1.4rem;opacity:' + (i < attacksLeft ? '1' : '0.25') + ';">⚡</span>';
            }

            modal.innerHTML = [
                '<div style="max-width:520px;width:100%;background:linear-gradient(135deg,rgba(5,8,20,0.98),rgba(10,5,25,0.98));border:2px solid rgba(255,170,0,0.5);border-radius:20px;padding:24px;max-height:90vh;overflow-y:auto;">',

                // Header
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">',
                '<div style="font-family:Orbitron,sans-serif;font-size:1.1rem;font-weight:900;color:#ffaa00;letter-spacing:.08em;">⚔️ RAID DIARIO</div>',
                '<button onclick="document.getElementById(\'raidLobbyModal\').remove()" style="background:none;border:1px solid #444;color:#888;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:.8rem;">✕ Cerrar</button>',
                '</div>',

                // Ataques disponibles
                '<div style="background:rgba(255,170,0,0.05);border:1px solid rgba(255,170,0,0.2);border-radius:12px;padding:12px 16px;margin-bottom:18px;">',
                '<div style="font-size:.7rem;color:#888;letter-spacing:.15em;margin-bottom:8px;">ATAQUES DISPONIBLES HOY</div>',
                '<div style="display:flex;gap:8px;align-items:center;">' + attackIcons + '<span style="color:#888;font-size:.8rem;margin-left:4px;">(' + attacksLeft + '/5)</span></div>',
                '</div>',

                // Lista de objetivos
                '<div style="font-size:.7rem;color:#888;letter-spacing:.15em;margin-bottom:10px;">🎯 TUS OBJETIVOS DE HOY</div>',
                '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">' + targetRows + '</div>',

                // Botón Buscar Rival (solo visible si atacó los 5 o no hay targets)
                (attacksLeft === 0 || targets.length === 0)
                    ? '<div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;"><div style="font-size:.75rem;color:#888;margin-bottom:10px;text-align:center;">Ataques diarios agotados — continúa con puntos reducidos</div><button onclick="document.getElementById(\'raidLobbyModal\').remove();startRankedMatchmaking();" style="width:100%;padding:13px;background:linear-gradient(135deg,rgba(0,196,255,0.15),rgba(0,196,255,0.08));border:2px solid #00c4ff;color:#00c4ff;border-radius:12px;cursor:pointer;font-family:Orbitron,sans-serif;font-size:.8rem;font-weight:700;letter-spacing:.08em;">🔍 BUSCAR RIVAL</button></div>'
                    : '',

                // Botón historial
                '<div style="margin-top:12px;text-align:center;"><button onclick="showRaidHistory()" style="background:none;border:1px solid rgba(255,255,255,0.15);color:#888;border-radius:8px;padding:8px 18px;cursor:pointer;font-size:.75rem;letter-spacing:.05em;">📋 Ver historial de batallas</button></div>',

                '</div>'
            ].join('');

            document.body.appendChild(modal);
        }

        function _escapeHtmlRaid(str) {
            return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        function raidAttackTarget(targetUid, targetName) {
            if (!currentUser) return;
            var todayKey = _getTodayMidnightKey();
            db.ref('ranked_stats/' + currentUser.uid + '/raidToday').once('value', function(snap) {
                var raidData = snap.val() || {};
                if (raidData.date !== todayKey || (raidData.attacksLeft || 0) <= 0) {
                    alert('Ya no tienes ataques disponibles hoy.');
                    return;
                }
                if (raidData.attackedTargets && raidData.attackedTargets.indexOf(targetUid) >= 0) {
                    alert('Ya atacaste a este rival hoy.');
                    return;
                }
                // ── Descontar ataque INMEDIATAMENTE en Firebase antes de lanzar la batalla ──
                var newAttacksLeft = Math.max(0, (raidData.attacksLeft || 5) - 1);
                var newAttackedTargets = (raidData.attackedTargets || []).concat([targetUid]);
                var newTargets = (raidData.targets || []).map(function(t) {
                    if (t.uid === targetUid) { t.attacked = true; t.result = 'pending'; }
                    return t;
                });
                var updatedRaid = {
                    date: raidData.date || todayKey,
                    attacksLeft: newAttacksLeft,
                    attackedTargets: newAttackedTargets,
                    targets: newTargets
                };
                db.ref('ranked_stats/' + currentUser.uid + '/raidToday').set(updatedRaid, function() {
                    var modal = document.getElementById('raidLobbyModal');
                    if (modal) modal.remove();

                    window._rankedIsRaidAttack = true;
                    window._rankedFromMatchmaking = true;
                    window._rankedMode = true;
                    window._rankedPlayerTeam = 'team1';
                    window._rankedFakeOpponent = targetName;
                    window._rankedDefenseOwnerUid = targetUid;

                    var myName = currentUser.displayName || 'Jugador';
                    window._teamNames = { team1: myName, team2: targetName };

                    db.ref('ranked_teams/' + targetUid).once('value', function(defSnap) {
                        var defData = defSnap.val() || {};
                        var defTeam = (defData.defense || []).filter(Boolean);
                        if (defTeam.length < 5) {
                            // Devolver ataque si el equipo no es válido
                            db.ref('ranked_stats/' + currentUser.uid + '/raidToday/attacksLeft').set(newAttacksLeft + 1);
                            alert('El equipo defensor no está completo. Elige otro objetivo.');
                            window._rankedIsRaidAttack = false;
                            window._rankedFromMatchmaking = false;
                            window._rankedMode = false;
                            showRaidLobby();
                            return;
                        }
                        getRankedTeams(function(myTeams) {
                            _launchRankedVsIAWithTeam(myTeams ? myTeams.attack : null, defTeam, targetName);
                        });
                    });
                });
            });
        }

        // ── FUNCIÓN DE ADMIN: reset manual de todos los jugadores ──
        function adminResetAllPlayers() {
            if (!currentUser) { alert('Debes estar logueado.'); return; }
            var seasonKey = getCurrentSeasonKey();
            if (!confirm('\u26A0\uFE0F \u00BFReiniciar puntuaci\u00F3n de TODOS los jugadores a 0?\nTemporada: ' + seasonKey)) return;
            db.ref('ranked_stats').once('value', function(snap) {
                var all = snap.val() || {};
                var updates = {};
                var count = 0;
                Object.keys(all).forEach(function(uid) {
                    updates[uid + '/points']        = 0;
                    updates[uid + '/atkPoints']     = 0;
                    updates[uid + '/defPoints']     = 0;
                    updates[uid + '/atkWins']       = 0;
                    updates[uid + '/atkLosses']     = 0;
                    updates[uid + '/atkDraws']      = 0;
                    updates[uid + '/defWins']       = 0;
                    updates[uid + '/defLosses']     = 0;
                    updates[uid + '/seasonKey']     = seasonKey;
                    updates[uid + '/attackHistory'] = null;
                    updates[uid + '/defenseHistory']= null;
                    updates[uid + '/raidToday']     = null;
                    count++;
                });
                db.ref('ranked_stats').update(updates, function(err) {
                    if (err) { alert('\u274C Error: ' + err.message); return; }
                    alert('\u2705 Reset completo. ' + count + ' jugadores reiniciados a 0 pts (Temporada ' + seasonKey + ').');
                    var lb = document.getElementById('leaderboardModal');
                    if (lb && lb.style.display !== 'none') showLeaderboard();
                });
            });
        }

        function showRaidHistory() {
            if (!currentUser) return;
            db.ref('ranked_stats/' + currentUser.uid).once('value', function(snap) {
                var data = snap.val() || {};
                var atkHistory = data.attackHistory  || [];
                var defHistory = data.defenseHistory || [];
                _renderRaidHistory(atkHistory, defHistory);
            });
        }

        function _renderRaidHistory(atkHistory, defHistory) {
            var existing = document.getElementById('raidHistoryModal');
            if (existing) existing.remove();

            function buildRows(history, isAtk) {
                if (!history.length) return '<div style="text-align:center;color:#555;padding:16px;font-size:.85rem;">Sin registros aún</div>';
                return history.map(function(e) {
                    var date = e.ts ? new Date(e.ts).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                    var resLabel, resColor;
                    if (e.result === 'win')  { resLabel = '✅ Victoria'; resColor = '#00ff88'; }
                    else if (e.result === 'loss') { resLabel = '❌ Derrota'; resColor = '#ff4466'; }
                    else { resLabel = '🤝 Empate'; resColor = '#ffaa00'; }
                    var pts = e.pts || 0;
                    var ptsColor = pts >= 0 ? '#00ff88' : '#ff4466';
                    var ptsStr = (pts >= 0 ? '+' : '') + pts + ' pts';
                    var modeTag = isAtk && e.isRaid
                        ? '<span style="font-size:.6rem;background:rgba(255,170,0,0.15);border:1px solid rgba(255,170,0,0.3);color:#ffaa00;border-radius:4px;padding:1px 5px;margin-left:4px;">RAID</span>'
                        : (isAtk ? '<span style="font-size:.6rem;background:rgba(0,196,255,0.1);border:1px solid rgba(0,196,255,0.2);color:#00c4ff;border-radius:4px;padding:1px 5px;margin-left:4px;">RIVAL</span>' : '');
                    var who = isAtk ? ('vs ' + _escapeHtmlRaid(e.opponent || 'CPU')) : ('por ' + _escapeHtmlRaid(e.attacker || '?'));
                    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.05);">' +
                        '<div style="flex:1;">' +
                            '<div style="font-size:.85rem;color:#ccc;">' + who + modeTag + '</div>' +
                            '<div style="font-size:.7rem;color:#555;margin-top:1px;">' + date + '</div>' +
                        '</div>' +
                        '<div style="text-align:right;">' +
                            '<div style="font-size:.8rem;color:' + resColor + ';">' + resLabel + '</div>' +
                            '<div style="font-size:.85rem;font-weight:700;color:' + ptsColor + ';">' + ptsStr + '</div>' +
                        '</div>' +
                    '</div>';
                }).join('');
            }

            var modal = document.createElement('div');
            modal.id = 'raidHistoryModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9100;display:flex;align-items:center;justify-content:center;padding:16px;';

            // Tab activo
            var activeTab = 'atk';
            modal.innerHTML = [
                '<div style="max-width:480px;width:100%;background:linear-gradient(135deg,rgba(5,8,20,0.98),rgba(10,5,25,0.98));border:2px solid rgba(255,255,255,0.1);border-radius:20px;overflow:hidden;max-height:85vh;display:flex;flex-direction:column;">',

                // Header
                '<div style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.08);">',
                '<div style="font-family:Orbitron,sans-serif;font-size:.95rem;font-weight:700;color:#fff;letter-spacing:.05em;">📋 HISTORIAL DE BATALLAS</div>',
                '<button onclick="document.getElementById(\'raidHistoryModal\').remove()" style="background:none;border:1px solid #444;color:#888;border-radius:8px;padding:4px 10px;cursor:pointer;font-size:.8rem;">✕</button>',
                '</div>',

                // Tabs
                '<div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.08);">',
                '<button id="raidTabAtk" onclick="raidSwitchTab(\'atk\')" style="flex:1;padding:10px;background:rgba(255,170,0,0.1);border:none;border-bottom:2px solid #ffaa00;color:#ffaa00;font-family:Orbitron,sans-serif;font-size:.7rem;font-weight:700;cursor:pointer;letter-spacing:.05em;">⚔️ ATAQUES</button>',
                '<button id="raidTabDef" onclick="raidSwitchTab(\'def\')" style="flex:1;padding:10px;background:none;border:none;border-bottom:2px solid transparent;color:#555;font-family:Orbitron,sans-serif;font-size:.7rem;font-weight:700;cursor:pointer;letter-spacing:.05em;">🛡️ DEFENSAS</button>',
                '</div>',

                // Content
                '<div id="raidHistoryContent" style="overflow-y:auto;flex:1;">',
                buildRows(atkHistory, true),
                '</div>',

                '</div>'
            ].join('');

            // Guardar historial en el modal para tab switching
            modal._atkHistory = atkHistory;
            modal._defHistory = defHistory;

            document.body.appendChild(modal);

            // Tab switch global
            window.raidSwitchTab = function(tab) {
                var m = document.getElementById('raidHistoryModal');
                if (!m) return;
                var content = document.getElementById('raidHistoryContent');
                var tabAtk  = document.getElementById('raidTabAtk');
                var tabDef  = document.getElementById('raidTabDef');
                if (tab === 'atk') {
                    content.innerHTML = buildRows(m._atkHistory, true);
                    tabAtk.style.borderBottomColor = '#ffaa00'; tabAtk.style.color = '#ffaa00'; tabAtk.style.background = 'rgba(255,170,0,0.1)';
                    tabDef.style.borderBottomColor = 'transparent'; tabDef.style.color = '#555'; tabDef.style.background = 'none';
                } else {
                    content.innerHTML = buildRows(m._defHistory, false);
                    tabDef.style.borderBottomColor = '#00c4ff'; tabDef.style.color = '#00c4ff'; tabDef.style.background = 'rgba(0,196,255,0.1)';
                    tabAtk.style.borderBottomColor = 'transparent'; tabAtk.style.color = '#555'; tabAtk.style.background = 'none';
                }
            };
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
            // Mark this as a legitimate ranked match from Buscar Rival
            window._rankedFromMatchmaking = true;
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
                    window._rankedFromMatchmaking = true;
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
                        window._rankedFromMatchmaking = true;
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
                    window._rankedFromMatchmaking = true;
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
                window._rankedFromMatchmaking = true;
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
            window._rankedFromMatchmaking = true;
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
                applyBattleBackground();
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
        // RANKED STATS — Sistema de Puntuación v2
        // ════════════════════════════════════════════════

        // ── Ligas ──
        var LEAGUES = [
            { name: 'Bronce',    min: 0,     max: 1499,  icon: '⚔️',  subs: ['III','II','I'] },
            { name: 'Plata',     min: 1500,  max: 3499,  icon: '🥈',  subs: ['III','II','I'] },
            { name: 'Oro',       min: 3500,  max: 6999,  icon: '🥇',  subs: ['III','II','I'] },
            { name: 'Diamante',  min: 7000,  max: 10999, icon: '💎',  subs: ['III','II','I'] },
            { name: 'Campeones', min: 11000, max: 14999, icon: '👑',  subs: [] },
            { name: 'Leyenda',   min: 15000, max: Infinity, icon: '🔱', subs: [] }
        ];

        function getLeague(points) {
            var p = Math.max(0, points || 0);
            for (var i = LEAGUES.length - 1; i >= 0; i--) {
                if (p >= LEAGUES[i].min) {
                    var lg = LEAGUES[i];
                    var sub = '';
                    if (lg.subs.length > 0) {
                        var range = lg.max - lg.min + 1;
                        var subSize = Math.floor(range / 3);
                        var offset = p - lg.min;
                        var subIdx = Math.min(2, Math.floor(offset / subSize));
                        // subIdx 0 = III (lowest), 1 = II, 2 = I (highest)
                        sub = lg.subs[2 - subIdx];
                    }
                    return { name: lg.name, icon: lg.icon, sub: sub, full: lg.icon + ' ' + lg.name + (sub ? ' ' + sub : '') };
                }
            }
            return { name: 'Bronce', icon: '⚔️', sub: 'III', full: '⚔️ Bronce III' };
        }

        function getLeagueIndex(points) {
            var p = Math.max(0, points || 0);
            for (var i = LEAGUES.length - 1; i >= 0; i--) {
                if (p >= LEAGUES[i].min) return i;
            }
            return 0;
        }

        // ══════════════════════════════════════════════════════
        // SISTEMA RAID DIARIO — Cálculo de puntos v2
        // ══════════════════════════════════════════════════════

        // ── Puntos para los 5 Ataques Diarios (alta recompensa) ──
        function calcRaidAttackPoints(won, survivingAllies, totalAllies, roundsElapsed, enemiesEliminated, totalEnemies, isDraw) {
            if (isDraw) return 20;
            if (!won) {
                // Derrota — penalización según rendimiento
                var deadAllies = totalAllies - survivingAllies;
                if (enemiesEliminated >= totalEnemies - 1 && deadAllies <= 1) return -20; // casi ganó
                if (enemiesEliminated >= 2) return -35;
                if (enemiesEliminated >= 1) return -50;
                return -80; // aplastado
            }
            // Victoria — base según bajas sufridas
            var base = 0;
            if (survivingAllies >= totalAllies)           base = 80; // perfecta: 0 bajas
            else if (survivingAllies >= totalAllies - 2)  base = 60; // sólida: 1-2 bajas
            else                                          base = 40; // ajustada: 3+ bajas
            // Bonus por velocidad
            var speedBonus = 0;
            if (roundsElapsed <= 3) speedBonus = Math.round(base * 0.15);
            // Bonus por aplaste total
            var cleanBonus = (enemiesEliminated >= totalEnemies && survivingAllies >= totalAllies) ? Math.round(base * 0.20) : 0;
            return base + speedBonus + cleanBonus;
        }

        // ── Puntos para Buscar Rival (post 5 ataques, baja recompensa, máx 10) ──
        function calcBuscarRivalPoints(won, survivingAllies, totalAllies, roundsElapsed, enemiesEliminated, totalEnemies, isDraw) {
            if (isDraw) return 5;
            if (!won) {
                if (enemiesEliminated >= totalEnemies - 1) return 4; // buena derrota
                if (enemiesEliminated >= 2)               return 3;
                if (enemiesEliminated >= 1)               return 2;
                return 1; // aplastado
            }
            // Victoria
            if (survivingAllies >= totalAllies && roundsElapsed <= 3) return 10; // perfecta
            if (survivingAllies >= totalAllies)                        return 9;
            if (survivingAllies >= totalAllies - 1 && roundsElapsed <= 4) return 8;
            if (survivingAllies >= totalAllies - 1)                    return 7;
            if (roundsElapsed <= 3)                                    return 8;
            if (survivingAllies >= totalAllies - 2)                    return 7;
            return 6; // victoria normal
        }

        // ── Puntos de defensa (siempre positivos) ──
        function calcDefensePoints(defenseWon, survivingDefenders, totalDefenders, roundsElapsed, attackersEliminated, totalAttackers, defTotalHpRemaining, defTotalHpMax) {
            if (defenseWon) {
                // Victoria defensiva
                if (survivingDefenders >= totalDefenders && attackersEliminated >= totalAttackers && roundsElapsed <= 3) return 50; // perfecta
                if (survivingDefenders >= totalDefenders - 1 && attackersEliminated >= totalAttackers) return 35; // sólida
                return 25; // costosa
            } else {
                // Derrota defensiva — siempre gana puntos positivos
                if (attackersEliminated >= 3) return 20; // resistió bien
                if (attackersEliminated >= 1 || roundsElapsed >= 5) return 10; // reñida
                return 3; // aplastada
            }
        }

        // ── Multiplicador diario legacy (solo para Buscar Rival) ──
        function getDailyMultiplier(battlesPlayedToday) {
            return 1.0; // Buscar Rival ya tiene cap en calcBuscarRivalPoints
        }

        // ── calcAttackPoints legacy (redirige al sistema correcto) ──
        function calcAttackPoints(won, survivingAllies, totalAllies, roundsElapsed, enemiesEliminated, totalEnemies, myLeagueIdx, oppLeagueIdx) {
            // Se mantiene por compatibilidad pero el nuevo sistema usa calcRaidAttackPoints/calcBuscarRivalPoints
            var base = won ? 100 : 15;
            var bonus = 0;
            if (won) {
                var aliveRatio = totalAllies > 0 ? survivingAllies / totalAllies : 0;
                if (aliveRatio >= 1.0)       bonus += 40;
                else if (aliveRatio >= 0.67) bonus += 20;
                else if (aliveRatio > 0)     bonus += 5;
                if (roundsElapsed <= 3)      bonus += 25;
                else if (roundsElapsed <= 5) bonus += 10;
                if (enemiesEliminated >= totalEnemies) bonus += 15;
            } else {
                if (enemiesEliminated >= 2)      bonus += 20;
                else if (enemiesEliminated >= 1) bonus += 10;
            }
            var total = base + bonus;
            var diff = oppLeagueIdx - myLeagueIdx;
            var mult = diff >= 2 ? 1.5 : diff === 1 ? 1.25 : diff === 0 ? 1.0 : diff === -1 ? 0.75 : 0.5;
            return Math.max(1, Math.round(total * mult));
        }

        // ── Obtener día actual como string YYYY-MM-DD ──
        function getTodayKey() {
            var d = new Date();
            return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        }

        // ── Obtener semana actual como string YYYY-Www ──
        function getCurrentSeasonKey() {
            var d = new Date();
            // Temporada mensual: YYYY-MM (del día 1 al último del mes)
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        }

        function saveRankedResult(winnerTeam, playerTeam, playerChars, opponentName, opponentChars, battleStats) {
            if (!currentUser || !window._rankedMode) return;
            window._rankedMode = false;
            if (!window._rankedFromMatchmaking || window._rankedSelfTest) {
                window._rankedFromMatchmaking = false;
                window._rankedSelfTest = false;
                addLog('Modo Prueba: los resultados NO se registran en el Leaderboard', 'info');
                return;
            }
            window._rankedFromMatchmaking = false;
            window._rankedSelfTest = false;

            var myUid   = currentUser.uid;
            var myName  = currentUser.displayName || 'Jugador';
            var isDraw  = (winnerTeam === 'draw');
            var won     = !isDraw && (winnerTeam === playerTeam);
            var fakeOpp = window._rankedFakeOpponent || opponentName;
            window._rankedFakeOpponent = null;
            var defOwnerUid = window._rankedDefenseOwnerUid || null;
            window._rankedDefenseOwnerUid = null;

            // Extraer stats de batalla (pasados desde turn-logic o defaults)
            var bs = battleStats || {};
            var survivingAllies    = bs.survivingAllies    || 0;
            var totalAllies        = bs.totalAllies        || 3;
            var roundsElapsed      = bs.roundsElapsed      || 5;
            var enemiesEliminated  = bs.enemiesEliminated  || 0;
            var totalEnemies       = bs.totalEnemies       || 3;
            var survivingDefenders = bs.survivingDefenders || 0;
            var totalDefenders     = bs.totalDefenders     || 3;
            var attackersEliminated= bs.attackersEliminated|| 0;
            var totalAttackers     = bs.totalAttackers     || 3;
            var defHpRemaining     = bs.defHpRemaining     || 0;
            var defHpMax           = bs.defHpMax           || 1;

            var seasonKey = getCurrentSeasonKey();
            var todayKey  = getTodayKey();
            var myRef     = db.ref('ranked_stats/' + myUid);

            myRef.once('value', function(snap) {
                var cur = snap.val() || {};
                cur.name = myName;

                // Obtener índice de liga propio y del oponente
                var myPoints  = cur.points || 0;
                var myLgIdx   = getLeagueIndex(myPoints);
                // Para oponente buscar sus puntos en DB (asíncrono simplificado — usar liga 0 si no se encuentra)
                var oppLgIdx  = 0;
                if (defOwnerUid) {
                    db.ref('ranked_stats/' + defOwnerUid + '/points').once('value', function(oppSnap) {
                        oppLgIdx = getLeagueIndex(oppSnap.val() || 0);
                        _finalizeSaveAttacker(cur, myRef, myUid, myName, won, survivingAllies, totalAllies, roundsElapsed, enemiesEliminated, totalEnemies, myLgIdx, oppLgIdx, seasonKey, todayKey, playerChars, defOwnerUid, fakeOpp, won, survivingDefenders, totalDefenders, roundsElapsed, attackersEliminated, totalAttackers, defHpRemaining, defHpMax, opponentChars, isDraw);
                    });
                } else {
                    _finalizeSaveAttacker(cur, myRef, myUid, myName, won, survivingAllies, totalAllies, roundsElapsed, enemiesEliminated, totalEnemies, myLgIdx, oppLgIdx, seasonKey, todayKey, playerChars, defOwnerUid, fakeOpp, won, survivingDefenders, totalDefenders, roundsElapsed, attackersEliminated, totalAttackers, defHpRemaining, defHpMax, opponentChars, isDraw);
                }
            });
        }

        function _finalizeSaveAttacker(cur, myRef, myUid, myName, won, survivingAllies, totalAllies, roundsElapsed, enemiesEliminated, totalEnemies, myLgIdx, oppLgIdx, seasonKey, todayKey, playerChars, defOwnerUid, fakeOpp, atkWon, survivingDefenders, totalDefenders, roundsElapsed2, attackersEliminated, totalAttackers, defHpRemaining, defHpMax, opponentChars, isDraw) {
            // ── Reset mensual: si el seasonKey cambió, reiniciar puntuación a 0 ──
            if (cur.seasonKey && cur.seasonKey !== seasonKey) {
                addLog('🔄 Nueva temporada (' + seasonKey + '): puntuación reiniciada a 0', 'info');
                cur.points    = 0;
                cur.atkPoints = 0;
                cur.defPoints = 0;
                cur.atkWins   = 0;
                cur.atkLosses = 0;
                cur.atkDraws  = 0;
                cur.defWins   = 0;
                cur.defLosses = 0;
                cur.attackHistory  = [];
                cur.defenseHistory = [];
                cur.raidToday = {};
            }

            // ── Determinar si es Raid Diario o Buscar Rival ──
            var isRaidAttack = window._rankedIsRaidAttack || false;
            window._rankedIsRaidAttack = false;

            // ── Calcular puntos ──
            var atkPoints;
            if (isRaidAttack) {
                atkPoints = calcRaidAttackPoints(won, survivingAllies, totalAllies, roundsElapsed, enemiesEliminated, totalEnemies, isDraw);
            } else {
                atkPoints = calcBuscarRivalPoints(won, survivingAllies, totalAllies, roundsElapsed, enemiesEliminated, totalEnemies, isDraw);
            }

            // ── Aplicar puntos ──
            // atkPoints puede ser negativo (derrota). Lo reflejamos en atkPoints acumulado.
            var prevAtkPoints = cur.atkPoints || 0;
            var prevDefPoints = cur.defPoints || 0;
            cur.atkPoints = prevAtkPoints + atkPoints; // puede ser negativo
            cur.defPoints = prevDefPoints;             // sin cambio aquí
            // points total = suma de atk + def (siempre coherente)
            cur.points    = Math.max(0, cur.atkPoints + cur.defPoints);
            cur.atkWins   = (cur.atkWins   || 0) + (won ? 1 : 0);
            cur.atkLosses = (cur.atkLosses || 0) + (!won && !isDraw ? 1 : 0);
            cur.atkDraws  = (cur.atkDraws  || 0) + (isDraw ? 1 : 0);
            cur.defWins   = cur.defWins  || 0;
            cur.defLosses = cur.defLosses || 0;
            cur.seasonKey = seasonKey;

            // ── Historial de ataques ──
            cur.attackHistory = cur.attackHistory || [];
            var atkEntry = {
                ts: Date.now(),
                opponent: fakeOpp || 'CPU',
                opponentUid: defOwnerUid || null,
                result: isDraw ? 'draw' : (won ? 'win' : 'loss'),
                pts: atkPoints,
                isRaid: isRaidAttack
            };
            cur.attackHistory.unshift(atkEntry);
            if (cur.attackHistory.length > 30) cur.attackHistory = cur.attackHistory.slice(0, 30);

            // ── Char usage ──
            cur.charStats = cur.charStats || {};
            (playerChars || []).forEach(function(c) {
                if (!c) return;
                cur.charStats[c] = cur.charStats[c] || { used: 0, wins: 0 };
                cur.charStats[c].used++;
                if (won) cur.charStats[c].wins++;
            });

            // ── Si es Raid, actualizar SOLO el resultado del target (attacksLeft ya fue decrementado en raidAttackTarget) ──
            if (isRaidAttack && defOwnerUid) {
                // Leer raidToday fresco desde Firebase para no sobreescribir con datos viejos
                db.ref('ranked_stats/' + myUid + '/raidToday').once('value', function(raidSnap) {
                    var freshRaid = raidSnap.val() || {};
                    if (!freshRaid.targets) freshRaid.targets = [];
                    freshRaid.targets = freshRaid.targets.map(function(t) {
                        if (t.uid === defOwnerUid) {
                            t.attacked = true;
                            t.result = isDraw ? 'draw' : (won ? 'win' : 'loss');
                            t.pts = atkPoints;
                        }
                        return t;
                    });
                    db.ref('ranked_stats/' + myUid + '/raidToday').set(freshRaid);
                });
            }

            db.ref('ranked_teams/' + myUid).once('value', function(myTeamSnap) {
                var myTeamData = myTeamSnap.val() || {};
                cur.currentAtkTeam = (myTeamData.attack  || []).filter(Boolean).slice(0,5);
                cur.currentDefTeam = (myTeamData.defense || []).filter(Boolean).slice(0,5);
                myRef.set(cur);
                var ptLabel = atkPoints >= 0 ? '+' + atkPoints : String(atkPoints);
                var modeLabel = isRaidAttack ? '⚔️ Raid' : '🔍 Rival';
                addLog('🏆 Puntos Ranked [' + modeLabel + ']: ' + ptLabel + ' | Total: ' + cur.points, atkPoints >= 0 ? 'buff' : 'damage');
            });

            // ── Guardar stats del defensor ──
            if (defOwnerUid) {
                _saveDef(defOwnerUid, fakeOpp, !won, survivingDefenders, totalDefenders, roundsElapsed, attackersEliminated, totalAttackers, defHpRemaining, defHpMax, seasonKey, todayKey, opponentChars, myName, myUid, isDraw);
                db.ref('ranked_notifications/' + defOwnerUid).push().set({
                    type: 'defense_attacked', attackerName: myName, attackerUid: myUid,
                    defenseWon: !won, ts: Date.now(), read: false
                });
            }

            _saveGlobalCharStats(playerChars, won, seasonKey);
            if (!defOwnerUid && opponentChars && opponentChars.length) {
                _saveGlobalCharStats(opponentChars, !won, seasonKey);
            }
        }

        function _saveDef(defOwnerUid, defOwnerName, defWon, survivingDefenders, totalDefenders, roundsElapsed, attackersEliminated, totalAttackers, defHpRemaining, defHpMax, seasonKey, todayKey, opponentChars, attackerName, attackerUid, isDraw) {
            var defRef = db.ref('ranked_stats/' + defOwnerUid);
            defRef.once('value', function(snap) {
                var cur = snap.val() || {};
                if (!cur.name) {
                    db.ref('ranked_teams/' + defOwnerUid).once('value', function(tSnap) {
                        var tData = tSnap.val() || {};
                        cur.name = tData.name || defOwnerName || defOwnerUid;
                        _applyDefPoints(cur, defRef, defOwnerUid, defWon, survivingDefenders, totalDefenders, roundsElapsed, attackersEliminated, totalAttackers, defHpRemaining, defHpMax, seasonKey, todayKey, opponentChars, attackerName, attackerUid, isDraw);
                    });
                } else {
                    _applyDefPoints(cur, defRef, defOwnerUid, defWon, survivingDefenders, totalDefenders, roundsElapsed, attackersEliminated, totalAttackers, defHpRemaining, defHpMax, seasonKey, todayKey, opponentChars, attackerName, attackerUid, isDraw);
                }
            });
        }

        function _applyDefPoints(cur, defRef, defOwnerUid, defWon, survivingDefenders, totalDefenders, roundsElapsed, attackersEliminated, totalAttackers, defHpRemaining, defHpMax, seasonKey, todayKey, opponentChars, attackerName, attackerUid, isDraw) {
            var rawDefPoints = calcDefensePoints(defWon, survivingDefenders, totalDefenders, roundsElapsed, attackersEliminated, totalAttackers, defHpRemaining, defHpMax);
            var defPoints    = Math.max(1, rawDefPoints);

            cur.defPoints = (cur.defPoints || 0) + defPoints;
            cur.atkPoints = cur.atkPoints || 0;
            // points total = suma de atk + def (siempre coherente)
            cur.points    = Math.max(0, cur.atkPoints + cur.defPoints);
            cur.defWins   = (cur.defWins   || 0) + (defWon ? 1 : 0);
            cur.defLosses = (cur.defLosses || 0) + (defWon ? 0 : 1);
            cur.atkWins   = cur.atkWins   || 0;
            cur.atkLosses = cur.atkLosses || 0;
            cur.seasonKey = seasonKey;

            // ── Historial de defensas ──
            cur.defenseHistory = cur.defenseHistory || [];
            var defEntry = {
                ts: Date.now(),
                attacker: attackerName || 'Desconocido',
                attackerUid: attackerUid || null,
                result: isDraw ? 'draw' : (defWon ? 'win' : 'loss'),
                pts: defPoints
            };
            cur.defenseHistory.unshift(defEntry);
            if (cur.defenseHistory.length > 30) cur.defenseHistory = cur.defenseHistory.slice(0, 30);

            db.ref('ranked_teams/' + defOwnerUid).once('value', function(tSnap) {
                var tData = tSnap.val() || {};
                cur.currentDefTeam = (tData.defense || []).filter(Boolean).slice(0,5);
                cur.currentAtkTeam = cur.currentAtkTeam || (tData.attack || []).filter(Boolean).slice(0,5);
                var defChars = (tData.defense || []).filter(Boolean);
                cur.charStats = cur.charStats || {};
                defChars.forEach(function(c) {
                    if (!c) return;
                    cur.charStats[c] = cur.charStats[c] || { used: 0, wins: 0 };
                    cur.charStats[c].used++;
                    if (defWon) cur.charStats[c].wins++;
                });
                _saveGlobalCharStats(defChars, defWon, seasonKey);
                defRef.set(cur);
            });
        }

        // ── Guardar stats globales de personajes (para panel de Meta) ──
        function _saveGlobalCharStats(chars, won, seasonKey) {
            if (!chars || !chars.length) return;
            var metaRef = db.ref('ranked_meta/' + seasonKey);
            metaRef.once('value', function(snap) {
                var meta = snap.val() || {};
                meta.totalBattles = (meta.totalBattles || 0) + 1;
                meta.chars = meta.chars || {};
                chars.forEach(function(c) {
                    if (!c) return;
                    meta.chars[c] = meta.chars[c] || { used: 0, wins: 0 };
                    meta.chars[c].used++;
                    if (won) meta.chars[c].wins++;
                });
                metaRef.set(meta);
            });
        }


        // ════════════════════════════════════════════════
        // LEADERBOARD v2 — Sistema de Ligas + Puntuación Dual
        // ════════════════════════════════════════════════

        function showLeaderboard() {
            var modal = document.getElementById('leaderboardModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'leaderboardModal';
                modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.93);z-index:10000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;box-sizing:border-box;';
                document.body.appendChild(modal);
                modal.innerHTML = [
                    '<div style="width:100%;max-width:960px;background:linear-gradient(135deg,#0a0e17,#0d1525);border:2px solid #ffaa00;border-radius:20px;padding:28px;box-shadow:0 0 60px rgba(255,170,0,0.2);">',
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;border-bottom:1px solid rgba(255,170,0,0.15);padding-bottom:16px;flex-wrap:wrap;gap:10px;">',
                        '<div>',
                            '<div style="font-family:Orbitron,sans-serif;font-size:1.4rem;font-weight:900;color:#ffaa00;text-shadow:0 0 20px rgba(255,170,0,0.6);letter-spacing:.08em;">🏆 RANKED LEADERBOARD</div>',
                            (currentUser && (currentUser.email === 'solisalex8291@gmail.com')
                                ? '<button onclick="adminResetAllPlayers()" style="background:rgba(255,30,30,0.15);border:1px solid #ff3366;color:#ff3366;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:.7rem;font-family:Orbitron,sans-serif;letter-spacing:.05em;margin-top:4px;">🔄 RESET TEMPORADA</button>'
                                : ''),
                            '<div id="leaderboardSeasonLabel" style="font-size:.72rem;color:#555;margin-top:3px;letter-spacing:.05em;">Temporada actual</div>',
                        '</div>',
                        '<div style="display:flex;gap:8px;align-items:center;">',
                            '<button id="lbBtnRanking" onclick="lbShowTab(\'ranking\')" style="background:rgba(255,170,0,0.2);border:1px solid #ffaa00;color:#ffaa00;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:.78rem;font-family:Orbitron,sans-serif;">🏅 RANKING</button>',
                            '<button id="lbBtnMeta" onclick="lbShowTab(\'meta\')" style="background:rgba(100,200,100,0.1);border:1px solid #4a4;color:#8f8;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:.78rem;font-family:Orbitron,sans-serif;">📊 META</button>',
                            '<button id="leaderboardCloseBtn" style="background:rgba(255,68,102,0.2);border:2px solid #ff4466;color:#ff4466;font-size:1.1rem;width:36px;height:36px;border-radius:50%;cursor:pointer;">✕</button>',
                        '</div>',
                    '</div>',
                    '<div id="leaderboardContent" style="color:#888;text-align:center;padding:3rem;font-size:.9rem;">Cargando...</div>',
                    '<div id="leaderboardMetaContent" style="display:none;color:#888;text-align:center;padding:3rem;font-size:.9rem;">Cargando Meta...</div>',
                    '</div>'
                ].join('');
                modal.querySelector('#leaderboardCloseBtn').onclick = function() { modal.style.display = 'none'; };
            }
            // Actualizar label de temporada
            var slabel = modal.querySelector('#leaderboardSeasonLabel');
            if (slabel) {
                var sk = getCurrentSeasonKey();
                var monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
                var parts = sk.split('-');
                var monthLabel = parts.length === 2 ? (monthNames[parseInt(parts[1],10)-1] + ' ' + parts[0]) : sk;
                slabel.textContent = 'Temporada ' + monthLabel + ' · Solo partidas Ranked';
            }
            modal.style.display = 'flex';
            lbShowTab('ranking');
        }

        window.lbShowTab = function(tab) {
            var rankingDiv = document.getElementById('leaderboardContent');
            var metaDiv    = document.getElementById('leaderboardMetaContent');
            var btnR = document.getElementById('lbBtnRanking');
            var btnM = document.getElementById('lbBtnMeta');
            if (!rankingDiv || !metaDiv) return;
            if (tab === 'ranking') {
                rankingDiv.style.display = '';
                metaDiv.style.display    = 'none';
                if (btnR) { btnR.style.background = 'rgba(255,170,0,0.35)'; btnR.style.borderColor = '#ffcc44'; }
                if (btnM) { btnM.style.background = 'rgba(100,200,100,0.1)'; btnM.style.borderColor = '#4a4'; }
                loadLeaderboardData();
            } else {
                rankingDiv.style.display = 'none';
                metaDiv.style.display    = '';
                if (btnM) { btnM.style.background = 'rgba(100,200,100,0.3)'; btnM.style.borderColor = '#6f6'; }
                if (btnR) { btnR.style.background = 'rgba(255,170,0,0.2)'; btnR.style.borderColor = '#ffaa00'; }
                loadMetaData();
            }
        };

        function loadLeaderboardData() {
            var container = document.getElementById('leaderboardContent');
            if (container) container.innerHTML = '<div style="color:#888;text-align:center;padding:2rem;">Cargando...</div>';
            db.ref('ranked_stats').once('value', function(snap) {
                var data = snap.val() || {};
                var seasonKey = getCurrentSeasonKey();
                var entries = Object.entries(data)
                    .filter(function(e) { return !e[1].isFake; })
                    .map(function(e) {
                        var v = e[1];
                        var pts    = Math.max(0, v.points || 0);
                        var atkW   = v.atkWins   || 0;
                        var atkL   = v.atkLosses || 0;
                        var defW   = v.defWins   || 0;
                        var defL   = v.defLosses || 0;
                        var totalG = atkW + defW;
                        var totalB = atkW + atkL + defW + defL;
                        var wr     = totalB > 0 ? Math.round((totalG / totalB) * 100) : 0;
                        return {
                            uid: e[0], name: v.name || e[0],
                            points: pts, league: getLeague(pts),
                            atkWins: atkW, atkLosses: atkL,
                            defWins: defW, defLosses: defL,
                            totalWins: totalG, totalLosses: atkL + defL,
                            totalBattles: totalB, winRate: wr,
                            atkPoints: v.atkPoints || 0,
                            defPoints: v.defPoints || 0,
                            // Siempre recalcular points como atkPoints + defPoints (corrige datos legacy)
                            points: Math.max(0, (v.atkPoints || 0) + (v.defPoints || 0)),
                            currentAtkTeam: v.currentAtkTeam || [],
                            currentDefTeam: v.currentDefTeam || [],
                        };
                    });
                entries.sort(function(a, b) { return b.points - a.points || b.winRate - a.winRate; });
                renderLeaderboard(entries);

                // ── Corregir puntos legacy en Firebase (atkPoints + defPoints != points) ──
                var legacyFixes = {};
                Object.entries(data).forEach(function(e) {
                    var uid = e[0], v = e[1];
                    if (!v || v.isFake) return;
                    var correctPts = Math.max(0, (v.atkPoints || 0) + (v.defPoints || 0));
                    if (v.points !== correctPts) {
                        legacyFixes[uid + '/points'] = correctPts;
                    }
                });
                if (Object.keys(legacyFixes).length > 0) {
                    db.ref('ranked_stats').update(legacyFixes);
                }
            });
        }

        function renderLeaderboard(entries) {
            var container = document.getElementById('leaderboardContent');
            if (!container) return;
            if (!entries.length) {
                container.innerHTML = '<div style="color:#555;text-align:center;padding:3rem;">Aún no hay partidas Ranked.<br><span style="font-size:.85rem;color:#444;">¡Sé el primero en jugar!</span></div>';
                return;
            }

            // Liga top-3 Gran Maestro
            var top3 = entries.filter(function(e) { return e.league.name === 'Leyenda'; }).slice(0,3);

            var rows = entries.map(function(e, i) {
                var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '<span style="font-family:Orbitron,sans-serif;font-size:.8rem;color:#666;">' + (i+1) + '</span>';
                // Colores por liga
                var lgColors = {
                    'Bronce':      { bg: 'rgba(180,100,30,0.10)',  border: 'rgba(205,127,50,0.40)',  glow: 'rgba(205,127,50,0.12)',  accent: '#cd7f32' },
                    'Plata':       { bg: 'rgba(180,180,200,0.08)', border: 'rgba(192,192,192,0.35)', glow: 'rgba(192,192,192,0.10)', accent: '#c0c0c0' },
                    'Oro':         { bg: 'rgba(255,200,0,0.09)',   border: 'rgba(255,215,0,0.40)',   glow: 'rgba(255,215,0,0.14)',   accent: '#ffd700' },
                    'Diamante':    { bg: 'rgba(0,200,255,0.08)',   border: 'rgba(0,220,255,0.35)',   glow: 'rgba(0,200,255,0.12)',   accent: '#00d4ff' },
                    'Campeones':     { bg: 'rgba(160,0,255,0.10)',   border: 'rgba(180,50,255,0.40)',  glow: 'rgba(160,0,255,0.16)',   accent: '#b432ff' },
                    'Leyenda':{ bg: 'rgba(255,100,0,0.10)',   border: 'rgba(255,130,0,0.45)',   glow: 'rgba(255,100,0,0.18)',   accent: '#ff8800' },
                };
                var lgC = lgColors[e.league.name] || lgColors['Bronce'];
                var bgGlow  = lgC.bg;
                var border  = lgC.border;
                var wrColor = e.winRate >= 60 ? '#00ff88' : e.winRate >= 40 ? '#ffaa00' : '#ff4466';

                // Equipos actuales
                var atkTeamHtml = (e.currentAtkTeam||[]).map(function(c) {
                    return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
                        '<img src="' + getCharPortrait(c) + '" title="' + escapeHtml(c) + '" referrerpolicy="no-referrer" ' +
                        'style="width:50px;height:50px;border-radius:7px;border:2px solid rgba(79,195,247,0.5);object-fit:cover;background:#111;" onerror="this.style.opacity=0.15">' +
                        '<span style="font-size:.52rem;color:#4fc3f7;max-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml((c||'').split(' ')[0]) + '</span>' +
                        '</div>';
                }).join('');
                var defTeamHtml = (e.currentDefTeam||[]).map(function(c) {
                    return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
                        '<img src="' + getCharPortrait(c) + '" title="' + escapeHtml(c) + '" referrerpolicy="no-referrer" ' +
                        'style="width:50px;height:50px;border-radius:7px;border:2px solid rgba(200,100,255,0.5);object-fit:cover;background:#111;" onerror="this.style.opacity=0.15">' +
                        '<span style="font-size:.52rem;color:#c864ff;max-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml((c||'').split(' ')[0]) + '</span>' +
                        '</div>';
                }).join('');

                return [
                    '<div style="background:' + bgGlow + ';border:1px solid ' + border + ';border-radius:14px;padding:14px 16px;margin-bottom:9px;box-shadow:0 0 18px ' + lgC.glow + ';">',
                    // Row 1: posición + nombre + liga + puntos
                    '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px;">',
                        '<div style="font-size:1.4rem;min-width:30px;text-align:center;">' + medal + '</div>',
                        '<div style="flex:1;min-width:120px;">',
                            '<div style="font-family:Orbitron,sans-serif;font-weight:700;color:#fff;font-size:.9rem;">' + escapeHtml(e.name) + '</div>',
                            '<div style="font-size:.72rem;color:' + lgC.accent + ';margin-top:2px;font-weight:600;">' + e.league.full + '</div>',
                        '</div>',
                        // Puntos globales
                        '<div style="background:rgba(255,170,0,0.1);border:1px solid rgba(255,170,0,0.3);border-radius:8px;padding:7px 12px;text-align:center;min-width:90px;">',
                            '<div style="font-size:.6rem;color:#ffaa00;letter-spacing:.05em;margin-bottom:3px;">⭐ PUNTOS</div>',
                            '<div style="font-family:Orbitron,sans-serif;font-size:1rem;color:#ffaa00;font-weight:900;">' + e.points.toLocaleString() + '</div>',
                            '<div style="font-size:.6rem;color:#888;margin-top:2px;"><span style="color:' + (e.atkPoints >= 0 ? '#4fc3f7' : '#ff4466') + ';">' + (e.atkPoints >= 0 ? '' : '') + e.atkPoints + ' atk</span> · <span style="color:#c864ff;">' + e.defPoints + ' def</span></div>',
                        '</div>',
                        // V/D GLOBAL eliminado por solicitud del usuario
                    '</div>',
                    // Row 2: equipos actuales
                    '<div style="display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start;">',
                        atkTeamHtml ? '<div><div style="font-size:.58rem;color:#4fc3f7;margin-bottom:5px;letter-spacing:.05em;">🗡️ EQUIPO ATAQUE</div><div style="display:flex;gap:5px;">' + atkTeamHtml + '</div></div>' : '',
                        defTeamHtml ? '<div><div style="font-size:.58rem;color:#c864ff;margin-bottom:5px;letter-spacing:.05em;">🛡️ EQUIPO DEFENSA</div><div style="display:flex;gap:5px;">' + defTeamHtml + '</div></div>' : '',
                    '</div>',
                    '</div>'
                ].join('');
            });
            container.innerHTML = rows.join('');
        }

        // ── Panel de Meta ──
        function loadMetaData() {
            var container = document.getElementById('leaderboardMetaContent');
            if (container) container.innerHTML = '<div style="color:#888;text-align:center;padding:2rem;">Cargando Meta...</div>';
            var seasonKey = getCurrentSeasonKey();
            db.ref('ranked_meta/' + seasonKey).once('value', function(snap) {
                var meta = snap.val() || {};
                var chars = meta.chars || {};
                var totalBattles = meta.totalBattles || 0;
                var totalPlayers = 0;
                db.ref('ranked_stats').once('value', function(snap2) {
                    var players = snap2.val() || {};
                    totalPlayers = Object.keys(players).filter(function(k) { return !players[k].isFake; }).length;

                    // Normalizar nombres: fusionar 'X v2' con 'X'
                    var normalizedChars = {};
                    Object.entries(chars).forEach(function(e) {
                        var rawName = e[0];
                        // Quitar sufijo ' v2', ' v3', etc.
                        var baseName = rawName.replace(/\s+v\d+$/i, '').trim();
                        if (!normalizedChars[baseName]) {
                            normalizedChars[baseName] = { used: 0, wins: 0 };
                        }
                        normalizedChars[baseName].used += (e[1].used || 0);
                        normalizedChars[baseName].wins += (e[1].wins || 0);
                    });

                    var entries = Object.entries(normalizedChars).map(function(e) {
                        var c = e[1];
                        var used = c.used || 0;
                        var wins = c.wins || 0;
                        var wr   = used > 0 ? Math.round((wins / used) * 100) : 0;
                        var pr   = totalBattles > 0 ? Math.round((used / (totalBattles * 2)) * 100) : 0;
                        // Índice de Dominio: WR% × log10(partidas + 1) × 10
                        var id   = Math.round((wr / 100) * Math.log10(used + 1) * 100) / 10;
                        return { name: e[0], used: used, wins: wins, wr: wr, pr: Math.min(100, pr), id: id };
                    });

                    // Ordenar por Índice de Dominio por defecto
                    entries.sort(function(a, b) { return b.id - a.id || b.used - a.used; });

                    if (!entries.length) {
                        container.innerHTML = '<div style="color:#555;text-align:center;padding:3rem;">Sin datos de Meta para esta temporada todavía.</div>';
                        return;
                    }

                    // Estado de ordenamiento en ventana
                    if (!window._metaSortBy) window._metaSortBy = 'wr';
                    window._metaEntries = entries; // guardar para re-ordenar sin refetch
                    window.renderMetaRows = function(sortBy) {
                        window._metaSortBy = sortBy || 'id';
                        var sorted = (window._metaEntries || []).slice();
                        if (sortBy === 'pr')      sorted.sort(function(a,b){ return b.pr - a.pr || b.used - a.used; });
                        else if (sortBy === 'games') sorted.sort(function(a,b){ return b.used - a.used || b.wr - a.wr; });
                        else if (sortBy === 'wr') sorted.sort(function(a,b){ return b.wr - a.wr || b.used - a.used; });
                        else                     sorted.sort(function(a,b){ return b.id - a.id || b.used - a.used; }); // default: Índice de Dominio
                        var rowsH = sorted.map(function(e, i) {
                            var wrColor  = e.wr >= 60 ? '#00ff88' : e.wr >= 50 ? '#ffaa00' : e.wr >= 40 ? '#ff8844' : '#ff4466';
                            var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1);
                            var portrait = getCharPortrait(e.name);
                            return [
                                '<div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:8px 10px;margin-bottom:5px;">',
                                    '<div style="width:30px;text-align:center;font-size:.85rem;">' + medal + '</div>',
                                    '<img src="' + portrait + '" referrerpolicy="no-referrer" style="width:38px;height:38px;border-radius:6px;object-fit:cover;border:1px solid rgba(255,255,255,0.1);background:#111;" onerror="this.style.opacity=0.15">',
                                    '<div style="flex:1;font-size:.82rem;color:#ddd;font-weight:600;">' + escapeHtml(e.name) + '</div>',
                                    '<div style="width:70px;text-align:center;font-size:.78rem;color:#88ccff;">' + e.pr + '%</div>',
                                    '<div style="width:70px;text-align:center;font-family:Orbitron,sans-serif;font-size:.82rem;font-weight:700;color:' + wrColor + ';">' + e.wr + '%</div>',
                                    '<div style="width:55px;text-align:center;font-size:.75rem;color:#666;">' + e.used + '</div>',
                                    '<div style="width:70px;text-align:center;font-family:Orbitron,sans-serif;font-size:.85rem;font-weight:900;color:#ffd700;">' + e.id.toFixed(1) + '</div>',
                                '</div>'
                            ].join('');
                        }).join('');
                        var rowsDiv = document.getElementById('metaRowsDiv');
                        if (rowsDiv) rowsDiv.innerHTML = rowsH;
                        // Actualizar estilos de botones activos
                        ['id','wr','pr','games'].forEach(function(s) {
                            var btn = document.getElementById('metaSort_' + s);
                            if (btn) btn.style.background = (s === sortBy || (!sortBy && s === 'id')) ? 'rgba(100,200,100,0.35)' : 'rgba(100,200,100,0.08)';
                        });
                    };
                    var headerHtml = [
                        '<div style="margin-bottom:12px;">',
                            '<div style="font-family:Orbitron,sans-serif;font-size:1rem;color:#8f8;margin-bottom:4px;">📊 META — Personajes más usados</div>',
                            '<div style="font-size:.72rem;color:#555;margin-bottom:10px;">Temporada ' + seasonKey + ' · ' + totalBattles + ' batallas</div>',
                            // Botones de orden
                            '<div style="display:flex;gap:6px;margin-bottom:12px;">',
                                '<span style="font-size:.65rem;color:#666;align-self:center;margin-right:4px;">Ordenar por:</span>',
                                '<button id="metaSort_id" onclick="window.renderMetaRows(\'id\')" style="background:rgba(100,200,100,0.08);border:1px solid #4a4;color:#8f8;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:.7rem;">⭐ Puntuación</button>',
                                '<button id="metaSort_wr" onclick="window.renderMetaRows(\'wr\')" style="background:rgba(100,200,100,0.08);border:1px solid #4a4;color:#8f8;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:.7rem;">🏆 Winrate</button>',
                                '<button id="metaSort_pr" onclick="window.renderMetaRows(\'pr\')" style="background:rgba(100,200,100,0.08);border:1px solid #4a4;color:#8f8;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:.7rem;">📊 Pick Rate</button>',
                                '<button id="metaSort_games" onclick="window.renderMetaRows(\'games\')" style="background:rgba(100,200,100,0.08);border:1px solid #4a4;color:#8f8;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:.7rem;">🎮 Partidas</button>',
                            '</div>',
                        '</div>',
                        '<div style="display:flex;gap:8px;margin-bottom:8px;font-size:.65rem;color:#555;padding:0 8px;">',
                            '<div style="width:30px;">#</div>',
                            '<div style="width:38px;"></div>',
                            '<div style="flex:1;">Personaje</div>',
                            '<div style="width:70px;text-align:center;">Pick Rate</div>',
                            '<div style="width:70px;text-align:center;">Winrate</div>',
                            '<div style="width:55px;text-align:center;">Partidas</div>',
                            '<div style="width:70px;text-align:center;">⭐ Punt.</div>',
                        '</div>',
                        '<div id="metaRowsDiv"></div>',
                    ].join('');

                    container.innerHTML = headerHtml;
                    // Renderizar filas con el orden por defecto (winrate)
                    window.renderMetaRows('id');
                });
            });
        }

        function getTopChars(charUsage, n) {
            if (!charUsage) return [];
            return Object.entries(charUsage)
                .sort(function(a, b) { return b[1] - a[1]; })
                .slice(0, n)
                .map(function(e) { return e[0]; });
        }

        // ── Reset semanal (Mes actual) ──
        function checkLeaderboardReset() {
            db.ref('leaderboard_meta/lastSeasonKey').once('value', function(snap) {
                var lastSeason  = snap.val() || '';
                var thisSeason  = getCurrentSeasonKey();
                if (lastSeason !== thisSeason) {
                    // Nueva temporada — archivar y resetear
                    db.ref('ranked_stats').once('value', function(archSnap) {
                        var archive = archSnap.val() || {};
                        if (Object.keys(archive).length > 0) {
                            // Guardar temporada anterior como archivo
                            db.ref('ranked_seasons/' + lastSeason).set(archive);
                            // Aplicar decaída del 30% y reset stats de batalla (mantener puntos reducidos)
                            var updates = {};
                            Object.entries(archive).forEach(function(e) {
                                var uid = e[0], v = e[1];
                                updates[uid] = {
                                    name: v.name,
                                    points: Math.floor((v.points || 0) * 0.70), // 30% decay
                                    atkPoints: 0, defPoints: 0,
                                    atkWins: 0, atkLosses: 0,
                                    defWins: 0, defLosses: 0,
                                    charStats: {},
                                    currentAtkTeam: v.currentAtkTeam || [],
                                    currentDefTeam: v.currentDefTeam || [],
                                    seasonKey: thisSeason,
                                    dailyBattles: {}
                                };
                            });
                            db.ref('ranked_stats').set(updates).then(function() {
                                db.ref('leaderboard_meta/lastSeasonKey').set(thisSeason);
                                console.log('[RANKED] Nueva temporada: ' + thisSeason + '. Puntos anteriores reducidos 30%.');
                            });
                        } else {
                            db.ref('leaderboard_meta/lastSeasonKey').set(thisSeason);
                        }
                    });
                }
            });
        }

        function getCharPortrait(charName) {
            if (typeof characterData !== 'undefined' && characterData[charName] && characterData[charName].portrait) {
                return characterData[charName].portrait;
            }
            var portraits = {
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
                'Flash':                'https://i.ibb.co/JRMKVsj5/Captura-de-pantalla-2026-03-26-174229.png',
                'Itachi Uchiha':        'https://i.ibb.co/JRPVCpGp/Captura-de-pantalla-2026-03-26-230228.png',
                'Shinobu Kocho':        'https://i.postimg.cc/9XnsvNBS/Whats_App_Image_2026_03_05_at_9_42_52_AM.jpg',
                'Tanjiro Kamado':       'https://i.postimg.cc/9XnsvNBS/Whats_App_Image_2026_03_05_at_9_42_52_AM.jpg',
            };
            return portraits[charName] || 'https://i.postimg.cc/PJr0LB6N/Captura_de_pantalla_2026_02_21_230603.png';
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
                applyBattleBackground();
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
