// ==================== INICIALIZACIÓN ====================
        function initGame(selectedCharacters) {
            // Reset full game state for new game
            gameState.selectedCharacter = null;
            gameState.selectedAbility = null;
            gameState.currentTurnIndex = 0;
            gameState.currentRound = 1;
            gameState.turnsInRound = 0;
            gameState.aliveCountAtRoundStart = 0;
            gameState.turnOrder = [];
            gameState.gameOver = false;
            gameState.winner = null;
            gameState._attackedThisTurn = false;
            gameState._miedoActive = false;
            gameState.summons = {};
            // Clear all summons completely
            // Clear battle log
            const logEl = document.getElementById('battleLogContent');
            if (logEl) {
                logEl.innerHTML = '';
                logEl.style.overflowY = 'auto';
                logEl.style.maxHeight = '420px';
                logEl.style.scrollbarWidth = 'thin';
            }
            gameState.battleLog = [];
            for (let k in gameState.summons) { delete gameState.summons[k]; }
            // Usar personajes seleccionados o todos por defecto
            const source = selectedCharacters || characterData;
            gameState.characters = JSON.parse(JSON.stringify(source));

            // ── BATTLE STATS: contadores para la pantalla de resultado épica ──
            gameState.battleStats = {
                // Existentes
                totalDamage: {},
                crits: 0,
                summonsKilled: 0,
                oversUsed: 0,
                healsGiven: 0,
                team1Damage: 0,
                team2Damage: 0,
                killMap: {},
                // MVP tracking — nuevos contadores
                critsByChar: {},       // crits por personaje × 2pts
                damageDone: {},        // daño causado × 0.15pts (nueva métrica)
                chargesGenSelf: {},    // cargas generadas para sí mismo × 0.5pts
                chargesGenAllies: {},  // cargas generadas para aliados × 1.5pts
                damageReceived: {},    // daño recibido por personaje × 1-2pts
                debuffsApplied: {},    // debuffs aplicados × 2pts
                buffsApplied: {},      // buffs aplicados × 2pts
                summonsDone: {},       // invocaciones realizadas × 3pts
                summonKills: {},       // kills causadas por invocación (+5pts al invocador)
                healingDone: {},       // HP curado a aliados × 1pt
                ccApplied: {},         // CC aplicado × 1.5pts
                poisonDamage: {},      // daño por veneno (para Dotters)
                burnDamage: {},        // daño por quemadura (para Dotters)
                // Quién puede aplicar veneno/quemadura (para dividir Dotters equitativamente)
                poisonAppliers: new Set(),
                burnAppliers: new Set(),
            };

            // ── PROXY: interceptar statusEffects.push para activar Monarca de la Destruccion ──
            // Esto garantiza que CUALQUIER buff aplicado (con push directo) active la pasiva
            function _wrapStatusEffects(charName) {
                const ch = gameState.characters[charName];
                if (!ch || !Array.isArray(ch.statusEffects)) return;
                const _origArr = ch.statusEffects;
                const _proxied = new Proxy(_origArr, {
                    get(target, prop) {
                        if (prop === '__isProxied') return true;
                        if (prop === 'push') {
                            return function(...items) {
                                const result = Array.prototype.push.apply(target, items);
                                // Activar Monarca si se agrega un buff a un personaje enemigo de Antares
                                items.forEach(function(item) {
                                    if (item && item.type === 'buff' && !item.passiveHidden &&
                                        typeof triggerMonarcaDestruccion === 'function') {
                                        triggerMonarcaDestruccion(charName);
                                    }
                                });
                                return result;
                            };
                        }
                        return target[prop];
                    }
                });
                ch.statusEffects = _proxied;
            }
            for (const _cn in gameState.characters) { _wrapStatusEffects(_cn); }

            // ── PATCH: interceptar asignaciones directas a statusEffects para mantener el Proxy ──
            // Cuando el código hace char.statusEffects = [...].filter(...), el Proxy se pierde.
            // Usamos un setter en cada personaje para re-envolverlo automáticamente.
            (function() {
                for (const _cn in gameState.characters) {
                    const _ch = gameState.characters[_cn];
                    if (!_ch) continue;
                    let _arr = _ch.statusEffects;
                    Object.defineProperty(_ch, 'statusEffects', {
                        get: function() { return _arr; },
                        set: function(newVal) {
                            _arr = newVal;
                            // Re-envolver con Proxy si es un array plano (no ya proxied)
                            if (Array.isArray(newVal) && !newVal.__isProxied) {
                                const _pArr = newVal;
                                const _name = _cn;
                                const _proxied2 = new Proxy(_pArr, {
                                    get(target2, prop2) {
                                        if (prop2 === '__isProxied') return true;
                                        if (prop2 === 'push') {
                                            return function(...items2) {
                                                const r = Array.prototype.push.apply(target2, items2);
                                                items2.forEach(function(item2) {
                                                    if (item2 && item2.type === 'buff' && !item2.passiveHidden &&
                                                        typeof triggerMonarcaDestruccion === 'function') {
                                                        triggerMonarcaDestruccion(_name);
                                                    }
                                                });
                                                return r;
                                            };
                                        }
                                        return target2[prop2];
                                    }
                                });
                                _arr = _proxied2;
                            }
                        },
                        configurable: true,
                        enumerable: true
                    });
                }
            })();
            
            // ── PASIVAS PERMANENTES (buffs que no expiran ni pueden limpiarse) ──
            for (const charName in gameState.characters) {
                const ch = gameState.characters[charName];
                if (!ch || !ch.passive) continue;
                const passiveName = ch.passive.name || '';
                const baseName = ch.baseName || charName; // baseName handles duplicates like "Aldebaran #2"
                
                // Thestalos: solo Contraataque permanente (sin Provocacion — Excel v5)
                if (baseName === 'Thestalos') {
                    ch.statusEffects = ch.statusEffects || [];
                    ch.statusEffects.push({ name: 'Contraataque', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '⚔️' });
                }
                // Aldebaran: Provocación permanente
                if (baseName === 'Aldebaran') {
                    ch.statusEffects = ch.statusEffects || [];
                    ch.statusEffects.push({ name: 'Provocacion', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🛡️' });
                }
                // Darth Vader: Aura Oscura permanente (Presencia Oscura)
                if (baseName === 'Darth Vader') {
                    ch.statusEffects = ch.statusEffects || [];
                    if (!ch.statusEffects.some(function(e){ return e && e.name === 'Aura oscura'; })) {
                        ch.statusEffects.push({ name: 'Aura oscura', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🌑' });
                    }
                }
                // Rey Brujo de Angmar: Provocación + Infectar permanentes (Señor de los Nazgul)
                if (baseName === 'Rey Brujo de Angmar') {
                    ch.statusEffects = ch.statusEffects || [];
                    ch.statusEffects.push({ name: 'Provocacion', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🛡️' });
                    ch.statusEffects.push({ name: 'Infectar', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🦠' });
                }
                // Anakin Skywalker: Contraataque permanente
                if (baseName === 'Anakin Skywalker') {
                    ch.anakinAsistir = true; // Asistir: fires basic when ally uses Special/Over ST
                }
                // Aspros de Gemini: Esquiva Área permanente
                if (baseName === 'Aspros de Gemini') {
                    ch.statusEffects = ch.statusEffects || [];
                    ch.statusEffects.push({ name: 'Esquiva Area', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '✨' });
                }
                // Minato Namikaze: Esquiva Área permanente
                if (baseName === 'Minato Namikaze') {
                    ch.statusEffects = ch.statusEffects || [];
                    ch.statusEffects.push({ name: 'Esquiva Area', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '⚡' });
                }
                // Flash: Esquiva Área permanente (Aceleración Constante)
                if (baseName === 'Flash') {
                    ch.statusEffects = ch.statusEffects || [];
                    if (!ch.statusEffects.some(function(e){ return e && (e.name||'').toLowerCase().replace(/\s/g,'') === 'esquivaarea'; })) {
                        ch.statusEffects.push({ name: 'Esquiva Area', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '⚡' });
                    }
                    ch.esquivaAreaPassive = true;
                }
                // Darth Vader: inmune a Miedo y Confusión + Aura Oscura permanente
                if (baseName === 'Darth Vader') {
                    ch.immuneToMiedo = true;
                    ch.immuneToConfusion = true;
                    ch.statusEffects = ch.statusEffects || [];
                    if (!ch.statusEffects.some(function(e){ return e && (e.name||'').toLowerCase().replace(/\s/g,'') === 'auraoscura'; })) {
                        ch.statusEffects.push({ name: 'Aura oscura', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🌑' });
                    }
                }
                // Gandalf: inmune a Posesión, Confusión y Miedo (flag)
                if (baseName === 'Gandalf') {
                    ch.immuneToMiedo = true;
                    ch.immuneToConfusion = true;
                    ch.immuneToPosesion = true;
                }
                // Lich King: inmune a Miedo, Posesión y Congelación (flag)
                if (charName === 'Lich King') {
                    ch.immuneToMiedo = true;
                    ch.immuneToPosesion = true;
                    ch.immuneToCongelacion = true;
                }
            }

            // Calcular orden de turnos
            calculateTurnOrder();
            
            // Snapshot de vivos al inicio de la primera ronda
            gameState.aliveCountAtRoundStart = Object.values(gameState.characters).filter(c => c && !c.isDead && c.hp > 0).length;
            // ── Aplicar efectos permanentes de pasivas al inicio ──
            for (let _pn in gameState.characters) {
                const _pc = gameState.characters[_pn];
                if (!_pc || !_pc.passive) continue;
                // Fortaleza de Tauro (Aldebaran) → Provocacion permanente
                if (_pc.passive.name === 'Fortaleza de Tauro') {
                    _pc.statusEffects = _pc.statusEffects || [];
                    if (!_pc.statusEffects.some(function(e){ return e && (e.name === 'Provocacion' || e.name === 'Provocación'); })) {
                        _pc.statusEffects.push({ name:'Provocacion', type:'buff', duration:9999, emoji:'🛡️', permanent:true });
                    }
                }
                // Señor de los Nazgul → Provocacion permanente
                if (_pc.passive.name === 'Señor de los Nazgul' || _pc.passive.name === 'Senor de los Nazgul') {
                    _pc.statusEffects = _pc.statusEffects || [];
                    if (!_pc.statusEffects.some(function(e){ return e && (e.name === 'Provocacion' || e.name === 'Provocación'); })) {
                        _pc.statusEffects.push({ name:'Provocacion', type:'buff', duration:9999, emoji:'🛡️', permanent:true });
                    }
                }
            }

            // Snapshot HP inicial para Aspecto de la Vida
            for (let n in gameState.characters) {
                const c = gameState.characters[n];
                if (c && !c.isDead) c.hpAtRoundStart = c.hp;
            }
            
            // Renderizar UI
            renderCharacters();
            renderTurnOrder();
            
            // Comenzar el primer turno
            startTurn();
        }

        // ==================== CÁLCULO DE ORDEN DE TURNOS ====================
        function calculateTurnOrder() {
            let allCharacters = [];
            for (let name in gameState.characters) {
                allCharacters.push({ name: name, speed: gameState.characters[name].speed });
            }
            
            // Ordenar por velocidad (mayor a menor)
            allCharacters.sort((a, b) => b.speed - a.speed);
            
            gameState.turnOrder = allCharacters.map(c => c.name);
        }

        // ==================== RENDERIZADO ====================

        // ── Build collapsed/summed display list from raw statusEffects ──
        function buildDisplayEffects(statusEffects) {
            if (!statusEffects || statusEffects.length === 0) return [];
            const display = [];
            let burnPct = 0, burnFlat = 0, burnDur = 0, burnAdded = false;
            let solarPct = 0, solarAdded = false;
            let bleedStack = 0, bleedAdded = false;
            let poisonMaxDur = 0, poisonStacks = 0, poisonAdded = false;

            statusEffects.forEach(function(e) {
                if (!e || !e.name) return;
                if (e.passiveHidden) return; // Pasivas permanentes no muestran icono
                const nn = normAccent(e.name);

                if (nn === 'quemadura') {
                    burnPct += (e.percent || 0);
                    burnFlat += (e.flatHp || 0);
                    if (e.duration !== undefined) burnDur = Math.max(burnDur, e.duration);
                    burnAdded = true;
                } else if (nn === 'quemadura solar') {
                    solarPct += (e.duration || 1); // acumular turnos en lugar de %
                    solarAdded = true;
                } else if (nn === 'sangrado') {
                    bleedStack += 1;
                    bleedAdded = true;
                } else if (nn === 'veneno') {
                    poisonStacks++;
                    poisonMaxDur = Math.max(poisonMaxDur, e.duration || 0);
                    poisonAdded = true;
                } else {
                    // Normal single display — use official emoji from _EFFECT_MAP if available
                    var _dispEmoji = e.emoji || '✨';
                    var _dispName = e.name;
                    if (typeof _EFFECT_MAP !== 'undefined' && _EFFECT_MAP[e.name]) {
                        _dispEmoji = _EFFECT_MAP[e.name].emoji;
                        if (_EFFECT_MAP[e.name].canonical) _dispName = _EFFECT_MAP[e.name].canonical;
                    }
                    display.push({ emoji: _dispEmoji, label: _dispName, sub: e.duration !== undefined ? e.duration : '', type: e.type });
                }
            });

            if (burnAdded) {
                if (burnFlat > 0) display.push({ emoji: '🔥', label: 'Quemadura ' + burnFlat + ' HP', sub: burnDur + 'T', type: 'debuff' });
                else if (burnPct > 0) display.push({ emoji: '🔥', label: 'Quemadura ' + burnPct + '%', sub: '', type: 'debuff' });
                else display.push({ emoji: '🔥', label: 'Quemadura', sub: '', type: 'debuff' });
            }
            if (solarAdded)  display.push({ emoji: '☀️', label: 'QS',  sub: solarPct + 'T', type: 'debuff' });
            if (bleedAdded)  display.push({ emoji: '🩸', label: 'Sangrado ' + bleedStack,        sub: '', type: 'debuff' });
            if (poisonAdded) display.push({ emoji: '☠️', label: 'Veneno',                        sub: poisonMaxDur + 'T', type: 'debuff' });

            return display;
        }

        // ── HP tick animation helper ──────────────────────────────────────
        function showHpTick(charName, delta) {
            if (!delta || delta === 0) return;
            const cardEl = document.getElementById('char-' + charName.replace(/\s+/g, '-'));
            if (!cardEl) return;
            const tick = document.createElement('div');
            tick.className = 'hp-tick ' + (delta > 0 ? 'heal' : 'dmg');
            tick.textContent = (delta > 0 ? '+' : '') + Math.round(delta);
            const rect = cardEl.getBoundingClientRect();
            tick.style.cssText = 'left:' + (rect.left + rect.width/2 - 22) + 'px;top:' + (rect.top + rect.height * 0.25) + 'px;position:fixed;';
            document.body.appendChild(tick);
            setTimeout(function(){ tick.remove(); }, 2400); // 2.4s so it's clearly visible
        }
        window.showHpTick = showHpTick;

        window._closeRelicPopup = function(){ var m=document.getElementById('_relicPopupModal'); if(m)m.remove(); };
        window._showRelicPopup = function(relicName) {
            if (!relicName) return;
            if (typeof RELICS_DATA === 'undefined' || !RELICS_DATA[relicName]) return;
            const rd = RELICS_DATA[relicName];
            const tierColors = { Raro:'#aaa', Especial:'#4fc3f7', Epico:'#c864ff', Legendario:'#ffd700' };
            const color = tierColors[rd.tier] || '#aaa';
            const existing = document.getElementById('_relicPopupModal');
            if (existing) existing.remove();
            const modal = document.createElement('div');
            modal.id = '_relicPopupModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;';
            modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
            var _relicHtml = '<div style="background:linear-gradient(135deg,#0a0e17,#12192e);border:2px solid ' + color + ';border-radius:16px;padding:24px 28px;max-width:320px;width:90%;text-align:center;box-shadow:0 0 40px ' + color + '44;">';
            if (rd.img) _relicHtml += '<img src="' + rd.img + '" style="width:72px;height:72px;object-fit:contain;border-radius:10px;border:2px solid ' + color + ';margin-bottom:10px;">';
            _relicHtml += '<div style="font-family:Orbitron,sans-serif;color:' + color + ';font-size:.9rem;font-weight:700;margin-bottom:4px;">' + relicName + '</div>';
            _relicHtml += '<div style="font-size:.72rem;color:' + color + ';margin-bottom:10px;opacity:.8;">[ ' + (rd.tier||'') + ' · ' + (rd.slot||'') + ' ]</div>';
            _relicHtml += '<div style="font-size:.78rem;color:#ccc;line-height:1.55;margin-bottom:16px;">' + (rd.desc||'Sin descripción') + '</div>';
            _relicHtml += '<button onclick="window._closeRelicPopup()" style="background:rgba(0,0,0,0.4);border:1px solid ' + color + ';color:' + color + ';padding:7px 20px;border-radius:8px;cursor:pointer;font-family:Orbitron,sans-serif;font-size:.7rem;">CERRAR</button></div>';
            modal.innerHTML = _relicHtml;
            document.body.appendChild(modal);
        };

        // Track previous HP to detect changes for tick animation
        var _prevHpMap = {};

        function renderTurnOrder() {
            // turnOrderList element removed in new layout — no-op kept for compatibility
            const turnOrderList = document.getElementById('turnOrderList');
            if (!turnOrderList) return;
            turnOrderList.innerHTML = '';
            (gameState.turnOrder || []).forEach(function(charName, index) {
                const char = gameState.characters[charName];
                if (!char || char.hp <= 0 || char.isDead) return;
                const isActive = index === gameState.currentTurnIndex;
                turnOrderList.innerHTML += '<div class="turn-order-item ' + (isActive ? 'active' : '') + '">' +
                    '<div style="font-size:.9em;opacity:.8;">#' + (index+1) + '</div>' +
                    '<div>' + charName + '</div>' +
                    '<div style="font-size:.85em;color:var(--warning);">⚡' + char.speed + '</div>' +
                    '</div>';
            });
        }

        function renderStatusEffects(char) {
            if (!char || !char.statusEffects) return '';
            const effects = char.statusEffects.filter(function(e){ return e && e.name && (e.duration === undefined || e.duration > 0); });
            if (!effects.length) return '';
            try {
                const displayEffects = buildDisplayEffects(effects);
                if (!displayEffects || !displayEffects.length) return '';
                let html = '';
                displayEffects.forEach(function(d) {
                    if (!d) return;
                    const cn = d.type === 'buff' ? 'buff' : 'debuff';
                    const sub = d.sub ? ' <span style="opacity:.65;font-size:.78em;">('+d.sub+')</span>' : '';
                    html += '<span class="status-effect ' + cn + '">' + (d.emoji||'') + ' ' + (d.label||'') + sub + '</span>';
                });
                return html;
            } catch(e) {
                // Fallback: simple render without buildDisplayEffects
                let html = '';
                effects.forEach(function(e) {
                    if (!e || !e.name) return;
                    const cn = e.type === 'buff' ? 'buff' : 'debuff';
                    const dur = e.duration !== undefined ? ' ('+e.duration+'T)' : '';
                    html += '<span class="status-effect ' + cn + '">' + (e.emoji||'•') + ' ' + e.name + dur + '</span>';
                });
                return html;
            }
        }

        function renderCharacters() {
            const team1Container = document.getElementById('team1Characters');
            const team2Container = document.getElementById('team2Characters');
            
            if (!team1Container || !team2Container) {
                console.error('Error: Contenedores de equipos no encontrados');
                return;
            }

            // HP tick detection removed - ticks fired directly in applyDamageWithShield and applyHeal
            var _newHpMap = {};
            
            team1Container.innerHTML = '';
            team2Container.innerHTML = '';
            
            for (let name in gameState.characters) {
                const char = gameState.characters[name];
                if (!char) continue;
                
                const container = char.team === 'team1' ? team1Container : team2Container;
                
                const isDefeated = char.hp <= 0;
                const isTransformed = (char.rikudoMode && (name === 'Madara Uchiha' || name === 'Madara Uchiha v2')) ||
                                      (char.fenixArmorActive && (name === 'Ikki de Fenix' || name === 'Ikki de Fenix v2')) ||
                                      (char.kuramaMode && (name === 'Minato Namikaze' || name === 'Minato Namikaze v2')) ||
                                      ((name === 'Alexstrasza' || name === 'Alexstrasza v2') && char.dragonFormActive) ||
                                      ((name === 'Goku' || name === 'Goku v2') && (char.ultraInstinto || char.gokuForm)) ||
                                      ((name === 'Naruto' || name === 'Naruto v2') && char.narutoForm) ||
                                      ((name === 'Antares' || name === 'Antares v2') && char.antaresTransformed) ||
                                      ((name === 'Meliodas' || name === 'Meliodas v2') && char._reyDemonioActive) ||
                                      ((name === 'Vegeta' || name === 'Vegeta v2') && char.vegetaForm) ||
                                      ((name === 'Anakin Skywalker' || name === 'Anakin Skywalker v2') && char.darkSideAwakened) ||
                                      ((name === 'Muzan Kibutsuji' || name === 'Muzan Kibutsuji v2') && char.muzanTransformed) ||
                                      (name === 'Garou' && char.garouSaitamaMode) ||
                                      ((name === 'Superman' || name === 'Superman v2') && char.supermanPrimeMode) ||
                                      ((name === 'Varian Wrynn' || name === 'Varian Wrynn v2') && char.varianTransformed) ||
                                      ((name === 'Escanor' || name === 'Escanor v2') && char.escanorTheOneActive) ||
                                      (name === 'Daemon Targaryen' && (char.daemonJineteTurns||0) > 0) ||
                                      ((name === 'Ikki de Fenix' || name === 'Ikki de Fenix v2') && char.fenixArmorActive);

                // Portrait dinámico por forma (Goku y Naruto)
                let _dynPortrait = char.portrait || char.transformPortrait || char.transformationPortrait || '';
                if ((name === 'Goku' || name === 'Goku v2') && char.gokuForm) {
                    if (char.gokuForm === 'ss1' && char.portraitSS1) _dynPortrait = char.portraitSS1;
                    else if (char.gokuForm === 'ss3' && char.portraitSS3) _dynPortrait = char.portraitSS3;
                    else if (char.gokuForm === 'ssblue' && char.portraitSSBlue) _dynPortrait = char.portraitSSBlue;
                    else if (char.gokuForm === 'ui' && char.portraitUI) _dynPortrait = char.portraitUI;
                } else if ((name === 'Naruto' || name === 'Naruto v2') && char.narutoForm) {
                    if (char.narutoForm === 'sabio' && char.portraitSabio) _dynPortrait = char.portraitSabio;
                    else if (char.narutoForm === 'kyubi' && char.portraitKyubi) _dynPortrait = char.portraitKyubi;
                    else if (char.narutoForm === 'baryon' && char.portraitBaryon) _dynPortrait = char.portraitBaryon;
                }
                // Portrait Escanor The One
                if ((name === 'Escanor' || name === 'Escanor v2') && char.escanorTheOneActive && char.transformPortrait) {
                    _dynPortrait = char.transformPortrait;
                }
                // Portrait Daemon Targaryen — Jinete de Dragones
                if (name === 'Daemon Targaryen' && (char.daemonJineteTurns||0) > 0 && char.transformPortrait) {
                    _dynPortrait = char.transformPortrait;
                }
                // Portrait Ikki de Fenix — Armadura Divina
                if ((name === 'Ikki de Fenix' || name === 'Ikki de Fenix v2') && char.fenixArmorActive && char.transformPortrait) {
                    _dynPortrait = char.transformPortrait;
                }
                // Portrait Antares transformado
                if ((name === 'Antares' || name === 'Antares v2') && char.antaresTransformed && char.transformPortrait) {
                    _dynPortrait = char.transformPortrait;
                }
                if ((name === 'Meliodas' || name === 'Meliodas v2') && char._reyDemonioActive && char.transformPortrait) {
                    _dynPortrait = char.transformPortrait;
                }
                // Portrait Vegeta por forma
                if ((name === 'Vegeta' || name === 'Vegeta v2') && char.vegetaForm) {
                    if (char.vegetaForm === 'ssblue_evo' && char.portraitSSBlueEvo) _dynPortrait = char.portraitSSBlueEvo;
                    else if (char.vegetaForm === 'ultra_ego' && char.portraitUltraEgo) _dynPortrait = char.portraitUltraEgo;
                }
                const activePortrait = _dynPortrait;
                const portraitHTML = activePortrait
                    ? `<img class="character-portrait${isDefeated ? ' defeated-img' : ''}" src="${activePortrait}" alt="${name}" loading="eager" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="character-portrait-placeholder" style="display:none">⚔️</div>`
                    : `<div class="character-portrait-placeholder">⚔️</div>`;

                // Build relic icons HTML
                const _relics = char.equippedRelics || [];
                let _relicIconsHTML = '';
                if (_relics.length > 0 && typeof RELICS_DATA !== 'undefined') {
                    _relics.forEach(function(rname) {
                        const _rd = RELICS_DATA[rname];
                        const _tierColor = { Raro:'#aaa', Especial:'#4fc3f7', Epico:'#c864ff', Legendario:'#ffd700' };
                        const _tc = _rd ? (_tierColor[_rd.tier]||'#aaa') : '#aaa';
                        if (_rd && _rd.img) {
                            _relicIconsHTML += '<img class="char-relic-icon" src="' + _rd.img + '" title="' + rname + '" style="border-color:' + _tc + ';cursor:pointer;" onclick="window._showRelicPopup(this.dataset.rn)" data-rn="' + rname.replace(/"/g,'&quot;') + '">';
                        } else {
                            _relicIconsHTML += '<div class="char-relic-dot" style="border-color:' + _tc + ';cursor:pointer;" title="' + rname + '" onclick="window._showRelicPopup(this.dataset.rn)" data-rn="' + rname.replace(/"/g,'&quot;') + '">💎</div>';
                        }
                    });
                }

                const _hpPct = char.maxHp > 0 ? char.hp / char.maxHp : 0;
                const _hpClass = _hpPct > 0.6 ? 'hp' : (_hpPct > 0.3 ? 'hp med' : 'hp low');
                const _chPct = Math.min(1, (char.charges || 0) / 20);
                const _chClass = (char.charges || 0) >= 20 ? 'ch full' : 'ch';
                const _sfx = renderStatusEffects(char);

                // ══ BOSS CARD — tarjeta especial para Jefe de Sala ══════════════════
                if (char.isBoss) {
                    // Determine boss accent color
                    const _bossName = (name || '').toLowerCase();
                    const _bossColor = _bossName.includes('lich') ? '#00c8ff' :   // Lich King = azul
                                       _bossName.includes('broly') ? '#00ff66' :  // Broly = verde
                                       '#00ff66'; // default green
                    const _bossGlow  = _bossName.includes('lich') ? 'rgba(0,200,255,0.55)' : 'rgba(0,255,100,0.55)';
                    const _bossGlow2 = _bossName.includes('lich') ? 'rgba(0,150,255,0.15)' : 'rgba(0,200,80,0.15)';

                    const _bossHpPct  = char.maxHp > 0 ? Math.max(0, char.hp / char.maxHp) : 0;
                    const _bossHpCls  = _bossHpPct > 0.6 ? '#00ff88' : _bossHpPct > 0.3 ? '#ffaa00' : '#ff3366';
                    const _bossChPct  = Math.min(1, (char.charges||0) / 20);
                    const _bossSfx    = renderStatusEffects(char);

                    const _bossCard = '<div class="character-card boss-card ' + (isDefeated ? 'defeated' : '') + '"' +
                        ' id="char-' + name.replace(/\s+/g,'-') + '"' +
                        ' data-charname="' + name + '"' +
                        ' style="border-color:' + _bossColor + ';box-shadow:0 0 18px ' + _bossGlow + ',0 0 40px ' + _bossGlow2 + ',inset 0 0 20px ' + _bossGlow2 + ';background:linear-gradient(160deg,rgba(8,12,22,0.97),rgba(4,8,18,0.99));">' +
                        // Top glow bar
                        '<div style="height:3px;width:100%;background:linear-gradient(90deg,transparent,' + _bossColor + ',transparent);border-radius:10px 10px 0 0;"></div>' +
                        // Portrait
                        '<div class="boss-portrait-wrap">' +
                        (activePortrait
                            ? '<img class="boss-portrait' + (isDefeated ? ' defeated-img' : '') + '" src="' + activePortrait + '" alt="' + name + '" loading="eager" referrerpolicy="no-referrer">'
                            : '<div class="boss-portrait-placeholder">👹</div>') +
                        // Name overlay on portrait
                        '<div class="boss-name-overlay" style="background:linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.6) 50%,transparent 100%);">' +
                        '<div style="font-family:Orbitron,sans-serif;font-size:.82rem;font-weight:700;color:' + _bossColor + ';letter-spacing:.05em;text-shadow:0 0 10px ' + _bossColor + ';margin-bottom:2px;">' + name + '</div>' +
                        '<div style="font-size:.62rem;color:#aaa;">⚡ ' + char.speed + ' &nbsp;|&nbsp; 💀 JEFE DE SALA</div>' +
                        '</div>' +
                        '</div>' +
                        // HP bar (full width)
                        '<div class="boss-bars">' +
                        '<div class="boss-bar-row">' +
                        '<span style="font-size:.65rem;color:#55ff99;margin-right:4px;">💚</span>' +
                        '<div class="boss-bar-track">' +
                        '<div class="boss-bar-fill" style="width:' + (_bossHpPct*100).toFixed(1) + '%;background:linear-gradient(90deg,' + _bossHpCls + ',' + _bossHpCls + 'aa);transition:width .4s ease;"></div>' +
                        '</div>' +
                        '<span style="font-size:.65rem;color:#ddd;min-width:70px;text-align:right;">' + char.hp.toLocaleString() + '/' + char.maxHp.toLocaleString() + '</span>' +
                        '</div>' +
                        // Charge bar (full width)
                        '<div class="boss-bar-row">' +
                        '<span style="font-size:.65rem;color:#00c8ff;margin-right:4px;">⚡</span>' +
                        '<div class="boss-bar-track">' +
                        '<div class="boss-bar-fill" style="width:' + (_bossChPct*100).toFixed(1) + '%;background:linear-gradient(90deg,' + (_bossChPct>=1?'#cc44ff':'#0088cc') + ',' + (_bossChPct>=1?'#aa22ee':'#00c8ff') + ');transition:width .4s ease;"></div>' +
                        '</div>' +
                        '<span style="font-size:.65rem;color:#ddd;min-width:30px;text-align:right;">' + (char.charges||0) + '</span>' +
                        '</div>' +
                        '</div>' +
                        // Status effects
                        (_bossSfx ? '<div class="boss-effects">' + _bossSfx + '</div>' : '') +
                        '</div>';

                    container.innerHTML += _bossCard;
                    continue; // skip normal card rendering
                }
                // ══ END BOSS CARD ════════════════════════════════════════════════════

                const cardHTML = '<div class="character-card ' + (isDefeated ? 'defeated' : '') + ' ' + (isTransformed ? 'transformed-mode' : '') + '"' +
                    ' id="char-' + name.replace(/\s+/g, '-') + '"' +
                    ' data-charname="' + name + '">' +
                    (char.shield > 0 ? '<div class="char-shield-bar"></div>' : '') +
                    '<div class="char-inner">' +
                    '<div class="char-portrait-wrap">' +
                    (activePortrait
                        ? '<img class="character-portrait' + (isDefeated ? ' defeated-img' : '') + '" src="' + activePortrait + '" alt="' + name + '" loading="eager" referrerpolicy="no-referrer">'
                        : '<div class="character-portrait-placeholder">⚔️</div>') +
                    '<div class="char-hp-overlay">' + char.hp + '/' + char.maxHp + (char.shield > 0 ? ' 🛡️'+char.shield : '') + '</div>' +
                    '</div>' +
                    '<div class="char-body">' +
                    '<div class="char-toprow">' +
                    '<span class="char-name-badge">' + name + (isTransformed ? ' ⚡' : '') + '</span>' +
                    '<span class="char-speed-badge">⚡' + char.speed + '</span>' +
                    '</div>' +
                    '<div class="char-bars">' +
                    '<div class="char-bar-row"><span class="char-bar-label" style="color:#55ff99;">💚</span><div class="char-bar-track"><div class="char-bar-fill ' + _hpClass + '" style="width:' + Math.max(0,_hpPct*100).toFixed(1) + '%"></div></div><span class="char-bar-val">' + char.hp + '/' + char.maxHp + '</span></div>' +
                    '<div class="char-bar-row"><span class="char-bar-label" style="color:#00c8ff;">⚡</span><div class="char-bar-track"><div class="char-bar-fill ' + _chClass + '" style="width:' + (_chPct*100).toFixed(1) + '%"></div></div><span class="char-bar-val">' + char.charges + '</span></div>' +
                    '</div>' +
                    (_relicIconsHTML ? '<div class="char-relics">' + _relicIconsHTML + '</div>' : '') +
                    '</div>' +
                    '</div>' +
                    (_sfx ? '<div class="char-effects-row">' + _sfx + '</div>' : '') +
                    '</div>';

                container.innerHTML += cardHTML;
            }

               // Ticks fired directly in applyDamageWithShield and applyHeal
        }
