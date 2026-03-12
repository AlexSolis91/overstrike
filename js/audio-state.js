// ==================== ESTADO DEL JUEGO ====================
        // ==================== AUDIO MANAGER ====================
        const audioManager = {
            currentTrack: null,
            volume: 0.5,
            muted: false,

            play: function(id) {
                // If same track already playing, do nothing (avoid restart)
                if (this.currentTrack === id) {
                    const cur = document.getElementById(id);
                    if (cur && !cur.paused) return;
                }
                // Stop previous track
                if (this.currentTrack && this.currentTrack !== id) {
                    const prev = document.getElementById(this.currentTrack);
                    if (prev) { try { prev.pause(); prev.currentTime = 0; } catch(e) {} }
                }
                this.currentTrack = id;
                if (this.muted) return;
                const el = document.getElementById(id);
                if (!el) return;
                el.volume = this.volume;
                el.play().catch(function(err) {
                    console.warn('Audio play failed for ' + id + ':', err.message);
                });
            },

            stop: function() {
                if (this.currentTrack) {
                    const el = document.getElementById(this.currentTrack);
                    if (el) { el.pause(); el.currentTime = 0; }
                    this.currentTrack = null;
                }
            },

            playRandomBattle: function() {
                // Stop any current track
                if (this.currentTrack) {
                    const prev = document.getElementById(this.currentTrack);
                    if (prev) { try { prev.pause(); prev.currentTime = 0; } catch(e) {} }
                }
                const trackNum = Math.floor(Math.random() * 5) + 1;
                const trackId = 'audioBattle' + trackNum;
                this.currentTrack = trackId;
                if (this.muted) return;
                const el = document.getElementById(trackId);
                if (!el) return;
                el.volume = this.volume;
                el.play().catch(function(err) {
                    console.warn('Battle audio play failed:', err.message);
                });
            },

            stopBattleMusic: function() {
                for (let i = 1; i <= 5; i++) {
                    const el = document.getElementById('audioBattle' + i);
                    if (el) { try { el.pause(); el.currentTime = 0; } catch(e) {} }
                }
                if (this.currentTrack && this.currentTrack.startsWith('audioBattle')) {
                    this.currentTrack = null;
                }
            },

            selectSfxUrl: 'https://AlejandroSolis.publit.io/file/Menu-Select-Sound-Super.mp3',

            playSelect: function() {
                if (this.muted) return;
                try {
                    const sfx = new Audio(this.selectSfxUrl);
                    sfx.volume = 0.6;
                    sfx.play().catch(function() {});
                } catch(e) {}
            },

            toggleMute: function() {
                this.muted = !this.muted;
                if (this.muted) {
                    ['audioMenu','audioBattle1','audioBattle2','audioBattle3','audioBattle4','audioBattle5','audioSelect'].forEach(function(id) {
                        const e = document.getElementById(id);
                        if (e) e.pause();
                    });
                } else {
                    if (audioManager.currentTrack) audioManager.play(audioManager.currentTrack);
                }
                const btn = document.getElementById('audioToggleBtn');
                if (btn) btn.textContent = this.muted ? '🔇' : '🔊';
            }
        };

        // Start menu music on first user interaction (browser autoplay policy)
        let audioStarted = false;
        function tryStartMenuMusic() {
            if (!audioStarted) {
                audioStarted = true;
                audioManager.play('audioMenu');
            }
        }
        document.addEventListener('click', tryStartMenuMusic, { once: true });
        document.addEventListener('keydown', tryStartMenuMusic, { once: true });
        // ==================== END AUDIO MANAGER ====================

        let gameState = {
            characters: {},
            turnOrder: [],
            gameMode: 'multi',
            aiTeam: null,
            currentTurnIndex: 0,
            battleLog: [],
            selectedCharacter: null,
            selectedAbility: null,
            gameOver: false,
            currentRound: 1,
            turnsInRound: 0,
            aliveCountAtRoundStart: 0, // Snapshot al inicio de ronda para no desincronizar
            summons: {} // Objeto para almacenar invocaciones activas
        };

        // Datos de invocaciones
        const summonData = {
            'Igris': {
                name: 'Igris',
                hp: 5,
                maxHp: 5,
                summoner: null,
                team: null,
                passive: 'Caballero de las sombras: Cada vez que el invocador genera carga, ataca a un enemigo aleatorio causando 2 de daño',
                statusEffects: []
            },
            'Iron': {
                name: 'Iron',
                hp: 8,
                maxHp: 8,
                summoner: null,
                team: null,
                passive: 'Iron Strength: Absorbe cualquier daño que fuera a recibir el invocador',
                statusEffects: []
            },
            'Tusk': {
                name: 'Tusk',
                hp: 5,
                maxHp: 5,
                summoner: null,
                team: null,
                passive: 'Himno de Fuego: Cuando un enemigo recibe daño por quemadura, duplica ese daño',
                statusEffects: []
            },
            'Beru': {
                name: 'Beru',
                hp: 5,
                maxHp: 5,
                summoner: null,
                team: null,
                passive: 'Al final de cada ronda causa 5 de daño a un enemigo aleatorio',
                statusEffects: []
            },
            'Bellion': {
                name: 'Bellion',
                hp: 8,
                maxHp: 8,
                summoner: null,
                team: null,
                passive: 'Una vez por ronda, la primera vez que un enemigo usa Special u Over, cancela su activación y causa 4 de daño',
                usedThisRound: false,
                statusEffects: []
            },
            'Kamish': {
                name: 'Kamish',
                hp: 30,
                maxHp: 30,
                summoner: null,
                team: null,
                megaProvocation: true,
                passive: 'Terror de las Sombras: Mega Provocación permanente. Cada vez que es golpeado, causa Quemaduras 25% 1T al atacante.',
                statusEffects: []
            },

            // ── LICH KING INVOCACIONES ──
            'Sindragosa': {
                name: 'Sindragosa',
                hp: 10, maxHp: 10,
                summoner: null, team: null,
                passive: 'Se invoca con buff Mega Provocación. Genera 1 punto de carga para todo el equipo aliado cada vez que recibe daño.',
                spawnChance: 0.24,
                statusEffects: []
            },
            'Kel Thuzad': {
                name: 'Kel Thuzad',
                hp: 8, maxHp: 8,
                summoner: null, team: null,
                passive: 'Aplica buff de Regeneración al equipo aliado por 20% por turno.',
                spawnChance: 0.24,
                statusEffects: []
            },
            'Darion Morgraine': {
                name: 'Darion Morgraine',
                hp: 8, maxHp: 8,
                summoner: null, team: null,
                passive: 'Aumenta la probabilidad de Crítico al equipo Aliado 50%.',
                spawnChance: 0.24,
                statusEffects: []
            },
            'Bolvar Fordragon': {
                name: 'Bolvar Fordragon',
                hp: 8, maxHp: 8,
                summoner: null, team: null,
                passive: 'Aumenta el daño de las habilidades del equipo aliado 100%.',
                spawnChance: 0.24,
                statusEffects: []
            },
            'Tirion Fordring': {
                name: 'Tirion Fordring',
                hp: 30, maxHp: 30,
                summoner: null, team: null,
                passive: 'Se invoca con buff Mega Provocación permanente. Cura 5 HP por turno al equipo aliado. Genera 5 puntos de Carga por turno al equipo aliado.',
                spawnChance: 0.04,
                statusEffects: []
            },
            // ── OZYMANDIAS INVOCACIONES ──
            'Sphinx Wehem-Mesut': {
                name: 'Sphinx Wehem-Mesut',
                hp: 8, maxHp: 8,
                summoner: null, team: null,
                passive: 'Cada vez que un enemigo recibe daño por Quemadura Solar, pierde 2 cargas.',
                statusEffects: []
            },
            'Ramesseum Tentyris': {
                name: 'Ramesseum Tentyris',
                hp: 20, maxHp: 20,
                summoner: null, team: null,
                passive: 'Al final de cada ronda, si hay enemigos sin debuff Quemadura Solar activo, aplica QS 5% 2 turnos a esos enemigos. Cada vez que un enemigo recibe daño por QS, todos los aliados recuperan 1 HP.',
                statusEffects: []
            }

        };

