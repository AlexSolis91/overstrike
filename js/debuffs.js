// ── HELPER: triggerIzanamiPartB ──
        // Called by applyFlatBurn, applyPoison, applyConfusion, and applyDebuff
        // when a trigger debuff (Quemadura/Veneno/Posesion/Confusion) hits any character.
        // If Itachi is on that character's team, he cleanses up to 2 debuffs + 2 charges each.
        function triggerIzanamiPartB(targetName) {
            // Itachi Izanami Parte B: al recibir debuff un aliado, limpia 1 debuff de un aliado ALEATORIO + 2 cargas
            // Flag por turno para evitar que un AOE limpie múltiples debuffs
            if (passiveExecuting) return;
            if (gameState._izanamiUsedThisTurn) return;
            const target = gameState.characters[targetName];
            if (!target || target.isDead || target.hp <= 0) return;
            const _izAllyTeam = target.team;
            for (const _izn in gameState.characters) {
                const _izc = gameState.characters[_izn];
                if (!_izc || _izc.isDead || _izc.hp <= 0 || _izc.team !== _izAllyTeam) continue;
                if (!_izc.passive || _izc.passive.name !== 'Izanami') continue;
                passiveExecuting = true;
                // Recoger aliados con al menos 1 debuff
                const _alliesWithDebuff = Object.keys(gameState.characters).filter(function(n) {
                    const c = gameState.characters[n];
                    return c && !c.isDead && c.hp > 0 && c.team === _izAllyTeam &&
                        (c.statusEffects || []).some(function(e) { return e && e.type === 'debuff' && !e.permanent; });
                });
                if (_alliesWithDebuff.length > 0) {
                    gameState._izanamiUsedThisTurn = true; // Un solo disparo por turno
                    // Elegir aliado aleatorio con debuff
                    const _randAlly = _alliesWithDebuff[Math.floor(Math.random() * _alliesWithDebuff.length)];
                    const _alc = gameState.characters[_randAlly];
                    const _dbs = (_alc.statusEffects || []).filter(function(e) { return e && e.type === 'debuff' && !e.permanent; });
                    if (_dbs.length > 0) {
                        const _rem = _dbs[Math.floor(Math.random() * _dbs.length)];
                        _alc.statusEffects = (_alc.statusEffects || []).filter(function(e) { return e !== _rem; });
                        addLog('Izanami: ' + (_rem.name||'Debuff') + ' limpiado de ' + _randAlly + ' (aliado aleatorio)', 'buff');
                        if (typeof triggerRinneganCleanse === 'function') triggerRinneganCleanse(_randAlly, 1);
                        _izc.charges = Math.min(20, (_izc.charges || 0) + 2);
                        addLog('Izanami: ' + _izn + ' genera 2 cargas', 'buff');
                    }
                }
                passiveExecuting = false;
                break;
            }
        }


        // ── PASIVA RINNEGAN (Madara): genera 3 cargas cuando un debuff es limpiado/disipado ──
        function triggerRinneganCleanse(targetName, count) {
            if (!count || count <= 0) return;
            const c = gameState.characters[targetName];
            if (!c || c.isDead || !c.passive || c.passive.name !== 'Rinnegan') return;
            const gained = count * 3;
            c.charges = Math.min(20, (c.charges || 0) + gained);
            addLog('👁️ Rinnegan: ' + targetName + ' genera ' + gained + ' cargas (' + count + ' debuff' + (count>1?'s':'') + ' disipado' + (count>1?'s':'') + ')', 'buff');
        }
function triggerMaboroshi(targetTeam, debuffName) {
            if (!debuffName) return;
            const norm = (debuffName || '').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
            if (norm !== 'posesion' && norm !== 'mega posesion') return;
            // Find any character with Maboroshi no Shinkiro passive on the OPPOSING team
            for (const sagaName in gameState.characters) {
                const saga = gameState.characters[sagaName];
                if (!saga || saga.isDead || saga.hp <= 0) continue;
                if (saga.team === targetTeam) continue; // Must be on the ATTACKER's team
                if (!saga.passive || saga.passive.name !== 'Maboroshi no Shinkiro') continue;
                saga.charges = Math.min(20, (saga.charges || 0) + 3);
                addLog('🌌 Maboroshi no Shinkiro: ' + sagaName + ' genera 3 cargas (' + debuffName + ' aplicado a enemigo)', 'buff');
                break;
            }
        }        // ==================== APLICADORES DE DEBUFFS ====================

        // Debuffs that cannot stack on the same target (must expire first)
        const NON_STACKABLE_DEBUFFS = ['aturdimiento', 'mega aturdimiento', 'congelacion', 'mega congelacion', 'posesion', 'mega posesion', 'silenciar', 'concentracion', 'esquivar', 'esquiva area', 'contraataque', 'espinas', 'armadura', 'escudo sagrado', 'proteccion sagrada', 'anticipacion'];

        
        // ═══════════════════════════════════════════════════════════
        // NUEVOS BUFFS/DEBUFFS - HELPERS
        // ═══════════════════════════════════════════════════════════

        function applyArmadura(targetName, duration) {
            applyBuff(targetName, { name: 'Armadura', type: 'buff', duration, emoji: '🛡️' });
            addLog(`🛡️ ${targetName} gana Buff Armadura (${duration} turno${duration>1?'s':''})`, 'buff');
        }

        function applyConcentracion(targetName, duration) {
            if (hasStatusEffect(targetName, 'Concentracion')) {
                addLog(`🎯 ${targetName} ya tiene Concentración activo`, 'info'); return;
            }
            applyBuff(targetName, { name: 'Concentracion', type: 'buff', duration, emoji: '🎯' });
            addLog(`🎯 ${targetName} gana Buff Concentración (${duration} turno${duration>1?'s':''})`, 'buff');
        }

        function applyAgotamiento(targetName, duration) {
            applyDebuff(targetName, { name: 'Agotamiento', type: 'debuff', duration, emoji: '😩' });
            addLog(`😩 ${targetName} sufre Agotamiento (${duration} turno${duration>1?'s':''})`, 'damage');
        }

        function applyMegaPosesion(targetName, duration) {
            if (hasStatusEffect(targetName, 'Mega Posesion')) {
                addLog(`👁️ ${targetName} ya tiene Mega Posesión activo`, 'info'); return;
            }
            const _mpTgt = gameState.characters[targetName];
            if (_mpTgt && _mpTgt.passive && _mpTgt.passive.name === 'Mente Brillante') {
                addLog('🪓 Mente Brillante: Ivar es inmune a Mega Posesión', 'buff'); return;
            }
            applyDebuff(targetName, { name: 'Mega Posesion', type: 'debuff', duration, emoji: '👁️' });
            addLog(`👁️ ${targetName} sufre Mega Posesión (${duration} turno${duration>1?'s':''})`, 'damage');
        }

        function applySilenciar(targetName, duration) {
            if (hasStatusEffect(targetName, 'Silenciar')) {
                addLog(`🔇 ${targetName} ya tiene Silenciar activo`, 'info'); return;
            }
            // Determinar categoría silenciada aleatoriamente
            const cats = ['basic', 'special', 'over'];
            const cat = cats[Math.floor(Math.random() * cats.length)];
            applyDebuff(targetName, { name: 'Silenciar', type: 'debuff', duration, silencedCategory: cat, emoji: '🔇' });
            addLog(`🔇 ${targetName} es Silenciado — categoría ${cat} bloqueada por ${duration} turno${duration>1?'s':''}`, 'damage');
            if (typeof registerCC === 'function' && gameState.selectedCharacter) registerCC(gameState.selectedCharacter);
        }

        function triggerAntipacion(extraTurnCharName) {
            // Cuando alguien gana turno extra, aliados ENEMIGOS con Anticipación golpean 3 veces
            const extraChar = gameState.characters[extraTurnCharName];
            if (!extraChar) return;
            const enemyTeam = extraChar.team === 'team1' ? 'team2' : 'team1';
            for (const name in gameState.characters) {
                const c = gameState.characters[name];
                if (!c || c.isDead || c.hp <= 0 || c.team !== enemyTeam) continue;
                if (!hasStatusEffect(name, 'Anticipacion')) continue;
                addLog(`⚡ Anticipación: ${name} reacciona al turno extra con 3 ataques básicos sobre ${extraTurnCharName}!`, 'buff');
                const basic = c.abilities && c.abilities[0];
                if (!basic) continue;
                for (let i = 0; i < 3; i++) {
                    passiveExecuting = true;
                    const savedSelected = gameState.selectedCharacter;
                    const savedAbility = gameState.selectedAbility;
                    gameState.selectedCharacter = name;
                    gameState.selectedAbility = basic;
                    gameState.adjustedCost = 0;
                    if (basic.damage > 0) {
                        applyDamageWithShield(extraTurnCharName, basic.damage, name);
                        addLog(`  ⚔️ Anticipación golpe ${i+1}: ${name} → ${extraTurnCharName} (${basic.damage} daño)`, 'damage');
                    }
                    gameState.selectedCharacter = savedSelected;
                    gameState.selectedAbility = savedAbility;
                    passiveExecuting = false;
                }
            }
        }


        // ══ OFFICIAL BUFF/DEBUFF NORMALIZATION ════════════════════════════════
        // Single source of truth for names and emojis.
        // Stackable: Quemadura, Veneno, Sangrado, Escudo (can have multiple instances)
        // All others: only 1 instance per character at a time (refreshes duration)
        const _EFFECT_MAP = {
            'Furia':              { emoji:'⚡',      stackable:false },
            'Frenesi':            { emoji:'🔥',      stackable:false, canonical:'Frenesí' },
            'Frenesí':            { emoji:'🔥',      stackable:false },
            'Escudo':             { emoji:'🛡️',     stackable:true  },
            'Escudo Sagrado':     { emoji:'✝️',      stackable:false },
            'Proteccion Sagrada': { emoji:'🛡️✨',   stackable:false, canonical:'Protección Sagrada' },
            'Protección Sagrada': { emoji:'🛡️✨',   stackable:false },
            'Regeneracion':       { emoji:'💖',      stackable:false, canonical:'Regeneración' },
            'Regeneración':       { emoji:'💖',      stackable:false },
            'Sigilo':             { emoji:'👤',      stackable:false },
            'Provocacion':        { emoji:'🛡️',     stackable:false, canonical:'Provocación' },
            'Provocación':        { emoji:'🛡️',     stackable:false },
            'MegaProvocacion':    { emoji:'🌑',      stackable:false, canonical:'Mega Provocación' },
            'Mega Provocacion':   { emoji:'🌑',      stackable:false, canonical:'Mega Provocación' },
            'Mega Provocación':   { emoji:'🌑',      stackable:false },
            'Esquivar':           { emoji:'💨',      stackable:false },
            'Esquiva Area':       { emoji:'🌟',      stackable:false, canonical:'Esquiva Área' },
            'Esquiva Área':       { emoji:'🌟',      stackable:false },
            'Contraataque':       { emoji:'🔄',      stackable:false },
            'Espinas':            { emoji:'🌵',      stackable:false },
            'Armadura':           { emoji:'🛡️',     stackable:false },
            'Celeridad':          { emoji:'⚡',      stackable:false },
            'Anticipacion':       { emoji:'👁️‍🗨️',   stackable:false, canonical:'Anticipación' },
            'Anticipación':       { emoji:'👁️‍🗨️',   stackable:false },
            'Concentracion':      { emoji:'🎯',      stackable:false, canonical:'Concentración' },
            'Concentración':      { emoji:'🎯',      stackable:false },
            'Cuerpo Perfecto':    { emoji:'💠',      stackable:false },
            'Divinidad':          { emoji:'✨',      stackable:false },
            'Aura de Fuego':      { emoji:'🔥',      stackable:false },
            'Aura de fuego':      { emoji:'🔥',      stackable:false, canonical:'Aura de Fuego' },
            'Aura Gelida':        { emoji:'❄️',      stackable:false, canonical:'Aura Gélida' },
            'Aura Gélida':        { emoji:'❄️',      stackable:false },
            'Aura Oscura':        { emoji:'🌑',      stackable:false },
            'Aura de Luz':        { emoji:'✨',      stackable:false },
            'Infectar':           { emoji:'🦠',      stackable:false },
            'Asistir':            { emoji:'🤝',      stackable:false },
            'Reflejar':           { emoji:'🪞',      stackable:false },
            // DEBUFFS
            'Quemadura':          { emoji:'🔥',      stackable:true  },
            'quemadura':          { emoji:'🔥',      stackable:true,  canonical:'Quemadura' },
            'Quemadura Solar':    { emoji:'☀️',      stackable:false },
            'Veneno':             { emoji:'☠️',      stackable:true  },
            'Sangrado':           { emoji:'🩸',      stackable:true  },
            'Aturdimiento':       { emoji:'⭐',      stackable:false },
            'Mega Aturdimiento':  { emoji:'💫',      stackable:false },
            'Congelacion':        { emoji:'❄️',      stackable:false, canonical:'Congelación' },
            'Congelación':        { emoji:'❄️',      stackable:false },
            'Mega Congelacion':   { emoji:'🧊',      stackable:false, canonical:'Megacongelación' },
            'Mega Congelación':   { emoji:'🧊',      stackable:false, canonical:'Megacongelación' },
            'Megacongelacion':    { emoji:'🧊',      stackable:false, canonical:'Megacongelación' },
            'Megacongelación':    { emoji:'🧊',      stackable:false },
            'MegaCongelacion':    { emoji:'🧊',      stackable:false, canonical:'Megacongelación' },
            'Miedo':              { emoji:'😱',      stackable:false },
            'Confusion':          { emoji:'😵',      stackable:false, canonical:'Confusión' },
            'Confusión':          { emoji:'😵',      stackable:false },
            'Posesion':           { emoji:'👁️',      stackable:false, canonical:'Posesión' },
            'Posesión':           { emoji:'👁️',      stackable:false },
            'Mega Posesion':      { emoji:'👁️👁️',  stackable:false, canonical:'Mega Posesión' },
            'Mega Posesión':      { emoji:'👁️👁️',  stackable:false },
            'Debilitar':          { emoji:'💔',      stackable:false },
            'Silenciar':          { emoji:'🔇',      stackable:false },
            'Silencio':           { emoji:'🔇',      stackable:false, canonical:'Silenciar' },
            'Agotamiento':        { emoji:'😴',      stackable:false },
        };

        // Normalize an effectObj: correct emoji, canonical name, enforce no-stack
        function _normalizeEffect(effectObj, target) {
            if (!effectObj || !effectObj.name) return effectObj;
            var info = _EFFECT_MAP[effectObj.name];
            if (info) {
                // Use official emoji
                effectObj.emoji = info.emoji;
                // Use canonical name if available
                if (info.canonical) effectObj.name = info.canonical;
                // Enforce no-duplicate for non-stackable effects
                if (!info.stackable && target && target.statusEffects) {
                    var existIdx = -1;
                    for (var _i = 0; _i < target.statusEffects.length; _i++) {
                        var _e = target.statusEffects[_i];
                        if (!_e) continue;
                        // Match by canonical name
                        var _eName = _e.name;
                        var _eInfo = _EFFECT_MAP[_eName];
                        var _eCanon = (_eInfo && _eInfo.canonical) ? _eInfo.canonical : _eName;
                        var _newCanon = info.canonical || effectObj.name;
                        if (_eCanon === _newCanon) { existIdx = _i; break; }
                    }
                    if (existIdx >= 0) {
                        // Refresh duration instead of stacking
                        if (effectObj.duration !== undefined) {
                            target.statusEffects[existIdx].duration = Math.max(
                                target.statusEffects[existIdx].duration || 0,
                                effectObj.duration
                            );
                        }
                        return null; // signal: don't push, already handled
                    }
                }
            }
            return effectObj;
        }
        window._normalizeEffect = _normalizeEffect;
        window._EFFECT_MAP = _EFFECT_MAP;
        // ══ END NORMALIZATION ═══════════════════════════════════════════════════

        function applyBuff(targetName, effectObj) {
            const target = gameState.characters[targetName];
            if (!target || !target.statusEffects) return;
            // ── PONZOÑA: el portador no puede recibir buffs ──
            const _hasPonzona = (target.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'ponzona'; });
            if (_hasPonzona) {
                addLog('☠️ Ponzoña: ' + targetName + ' no puede recibir buffs', 'debuff');
                return;
            }
            // SABIDURÍA ANTIGUA (Yoda): inmune a buffs (los enemigos no pueden buffear a Yoda)
            // Sus propias habilidades sí aplican buffs a sus ALIADOS — no a Yoda mismo
            if (target.passive && target.passive.name === 'Sabiduría Antigua') {
                return; // Yoda rechaza cualquier buff externo silenciosamente
            }

            // ── HARD DEDUP: non-stackable buffs cannot stack ──
            if (effectObj && effectObj.name) {
                var _bnm = effectObj.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
                var _bstack = ['escudo','quemadura','veneno','sangrado'];
                if (_bstack.indexOf(_bnm) < 0) {
                    var _bex = (target.statusEffects || []).findIndex(function(e) {
                        if (!e || !e.name) return false;
                        return e.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === _bnm;
                    });
                    if (_bex >= 0) {
                        if (effectObj.duration !== undefined) {
                            target.statusEffects[_bex].duration = Math.max(
                                target.statusEffects[_bex].duration || 0, effectObj.duration);
                        }
                        return;
                    }
                }
            }

            // ── SIX PATHS (Pain): 50% interceptar buff aplicado sobre un ENEMIGO ──
            // Pain solo intercepta buffs en el equipo contrario al suyo
            if (!passiveExecuting && effectObj && effectObj.type === 'buff') {
                for (const _pn in gameState.characters) {
                    const _pain = gameState.characters[_pn];
                    if (!_pain || _pain.isDead) continue;
                    if (!_pain.passive || _pain.passive.name !== 'Six Paths') continue;
                    // Only fire if target is on the OPPOSITE team to Pain
                    if (_pain.team === target.team) break; // target is ally of Pain → skip
                    if (Math.random() < 0.5) {
                        const _sixAllyTeam = _pain.team;
                        for (const _an in gameState.characters) {
                            const _ac = gameState.characters[_an];
                            if (_ac && _ac.team === _sixAllyTeam && !_ac.isDead) {
                                _ac.charges = Math.min(20, (_ac.charges||0) + 3);
                            }
                        }
                        addLog('👁️ Six Paths: buff ' + (effectObj.name||'') + ' sobre ' + targetName + ' disipado (+3 cargas al equipo aliado)', 'buff');
                        return;
                    }
                    break;
                }
            }
            // No stackeable si ya existe (salvo stackeables explícitos)
            const stackable = ['furia', 'frenesi', 'regeneracion', 'escudo', 'celeridad', 'armadura', 'anticipacion', 'sangrado', 'debilitar', 'confusion', 'miedo', 'agotamiento', 'veneno', 'quemadura', 'quemadura solar'];
            const effNorm = normAccent(effectObj.name || '');
            if (!stackable.includes(effNorm)) {
                if (target.statusEffects.some(e => e && normAccent(e.name || '') === effNorm)) {
                    addLog(`✨ ${targetName} ya tiene ${effectObj.name} activo`, 'info');
                    return;
                }
            }
                        // Normalize: fix emoji, canonical name
            if (typeof _normalizeEffect === 'function') {
                effectObj = _normalizeEffect(effectObj, target);
                if (!effectObj) return; // no-stack: duration refreshed, don't push
            }

            // ── HARD DEDUPLICATION: non-stackable debuffs cannot stack ──
            // (catches direct pushes and any path that bypassed _normalizeEffect)
            (function() {
                if (!effectObj || !effectObj.name) return;
                var _nm = effectObj.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
                var _stackable = ['quemadura','veneno','sangrado','escudo'];
                if (_stackable.indexOf(_nm) >= 0) return; // stackable - allow
                // Check if already present
                var _existing = (target.statusEffects || []).findIndex(function(e) {
                    if (!e || !e.name) return false;
                    var _en = e.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
                    return _en === _nm;
                });
                if (_existing >= 0) {
                    // Refresh duration
                    if (effectObj.duration !== undefined) {
                        target.statusEffects[_existing].duration = Math.max(
                            target.statusEffects[_existing].duration || 0,
                            effectObj.duration
                        );
                    }
                    effectObj = null; // cancel push
                }
            })();
            if (!effectObj) return;

            // ── SIX PATHS (Pain): 50% interceptar debuff en aliado ──
            if (!passiveExecuting) {
                for (const _pn in gameState.characters) {
                    const _pain = gameState.characters[_pn];
                    if (!_pain || _pain.isDead || _pain.team !== target.team) continue;
                    if (!_pain.passive || _pain.passive.name !== 'Six Paths') continue;
                    if (Math.random() < 0.5) {
                        _pain.charges = Math.min(20, (_pain.charges||0) + 3);
                        addLog('👁️ Six Paths: debuff ' + (effectObj.name||'') + ' sobre ' + targetName + ' bloqueado (+3 cargas a Pain)', 'buff');
                        return;
                    }
                    break;
                }
            }
            target.statusEffects.push(effectObj);
            // ── Notificar a SJW Arise!: +2 cargas por buff aplicado sobre ENEMIGO ──
            if (typeof notifyEnemyBuffApplied === 'function' && !passiveExecuting && effectObj && effectObj.type === 'buff') {
                const _neb_team = target.team;
                const _sjwExists = Object.values(gameState.characters||{}).some(function(c){ return c && c.passive && c.passive.name === 'Arise!' && c.team !== _neb_team && !c.isDead && c.hp > 0; });
                if (_sjwExists) notifyEnemyBuffApplied(targetName);
            }
            // ── VISIÓN DE PROFETA (Grindelwald): cuando un buff se aplica a un ENEMIGO, limpia ese buff + 2 más de 2 enemigos aleatorios ──
            if (!passiveExecuting && effectObj && effectObj.type === 'buff') {
                const _gTeam = target.team; // team of the buffed char
                const _grindTeam = _gTeam === 'team1' ? 'team2' : 'team1'; // Grindelwald's team
                for (const _gn in gameState.characters) {
                    const _gc = gameState.characters[_gn];
                    if (!_gc || _gc.team !== _grindTeam || _gc.isDead || _gc.hp <= 0) continue;
                    if (!_gc.passive || _gc.passive.name !== 'Visión de Profeta') continue;
                    // Grindelwald is on the opposite team — strip the just-applied buff immediately
                    target.statusEffects = (target.statusEffects||[]).filter(function(e){ return e !== effectObj; });
                    addLog('🔮 Visión de Profeta: limpia buff ' + (effectObj.name||'') + ' de ' + targetName, 'buff');
                    // Strip 2 more buffs from 2 random enemies (Grindelwald's enemies = _gTeam)
                    const _gEnemies = Object.keys(gameState.characters).filter(function(n){ const c=gameState.characters[n]; return c&&c.team===_gTeam&&!c.isDead&&c.hp>0; });
                    for (let _gi=0; _gi<2; _gi++) {
                        if (_gEnemies.length===0) break;
                        const _gTgt = _gEnemies[Math.floor(Math.random()*_gEnemies.length)];
                        const _gC2 = gameState.characters[_gTgt];
                        const _gBuffs = (_gC2.statusEffects||[]).filter(function(e){ return e&&e.type==='buff'&&!e.permanent; });
                        if (_gBuffs.length>0) {
                            const _gRem = _gBuffs[Math.floor(Math.random()*_gBuffs.length)];
                            _gC2.statusEffects = (_gC2.statusEffects||[]).filter(function(e){ return e!==_gRem; });
                            addLog('🔮 Visión de Profeta: limpia buff ' + (_gRem.name||'') + ' de ' + _gTgt, 'buff');
                        }
                    }
                    break; // Only one Grindelwald
                }
            }
            // ── CELERIDAD: aplicar aumento de velocidad inmediatamente ──
            if (effectObj && normAccent(effectObj.name||'') === 'celeridad') {
                let _celBonus = 0;
                if (effectObj.speedBonus && effectObj.speedBonus < 1) {
                    // Es porcentaje decimal (ej. 0.15 = 15%) → calcular valor absoluto
                    _celBonus = Math.round((target.speed||80) * effectObj.speedBonus);
                } else if (effectObj.speedBonus && effectObj.speedBonus >= 1) {
                    // Ya es valor absoluto
                    _celBonus = effectObj.speedBonus;
                }
                if (_celBonus > 0) {
                    // Guardar siempre como valor absoluto para el expiry
                    effectObj.speedBonus = _celBonus;
                    target.speed = (target.speed||80) + _celBonus;
                }
            }
            if (typeof _animCard === 'function' && !effectObj.passiveHidden) {
                _animCard(targetName, 'anim-charge', 550);
            }
            // ── ORGULLO VILTRUMITA (Omni-Man): si buff aplicado al equipo enemigo → +3 cargas ──
            if (!effectObj.passiveHidden) {
                const _ovBuffTgt = gameState.characters[targetName];
                if (_ovBuffTgt) {
                    for (const _omN in gameState.characters) {
                        const _omC = gameState.characters[_omN];
                        if (!_omC || _omC.isDead || _omC.hp <= 0 || !_omC.passive) continue;
                        if (_omC.passive.name !== 'Orgullo Viltrumita') continue;
                        if (_omC.team === _ovBuffTgt.team) continue; // solo si el buff fue al equipo ENEMIGO de Omni-Man
                        _omC.charges = Math.min(20, (_omC.charges||0) + 3);
                        addLog('🦸 Orgullo Viltrumita: Omni-Man +3 cargas (buff aplicado a enemigo)', 'buff');
                        break;
                    }
                }
            }
            // MVP: registrar buff aplicado (buffs visibles en aliados aplicados activamente)
            if (!effectObj.passiveHidden && gameState.selectedCharacter) {
                const _caster = gameState.characters[gameState.selectedCharacter];
                const _tgt = gameState.characters[targetName];
                // Solo registrar si el caster y el target son aliados Y hay una habilidad activa seleccionada
                if (_caster && _tgt && _caster.team === _tgt.team &&
                    gameState.selectedAbility && typeof registerBuff === 'function') {
                    registerBuff(gameState.selectedCharacter);
                }
            }
            // MONARCA DE LA DESTRUCCION: 2 daño si se aplica Buff a un personaje que es enemigo de Antares
            // Solo disparar si NO estamos en ejecución pasiva (evita doble trigger)
            if (!passiveExecuting && typeof triggerMonarcaDestruccion === 'function') {
                triggerMonarcaDestruccion(targetName);
            }

            // EMPERADOR DE LA GALAXIA (Palpatine): buff aplicado a enemigo → aliado aleatorio +2 cargas
            if (!passiveExecuting) {
                const _epTgt = gameState.characters[targetName];
                const _epTgtTeam = _epTgt ? _epTgt.team : null;
                if (_epTgtTeam) {
                    const _epAlly = _epTgtTeam === 'team1' ? 'team2' : 'team1';
                    for (const _pN in gameState.characters) {
                        const _pC = gameState.characters[_pN];
                        if (!_pC || _pC.isDead || !_pC.passive) continue;
                        if (_pC.passive.name !== 'Emperador de la Galaxia') continue;
                        if (_pC.team !== _epAlly) continue;
                        // Elegir un aliado aleatorio de Palpatine
                        const _pallies = Object.keys(gameState.characters).filter(function(n){
                            const _cc = gameState.characters[n];
                            return _cc && _cc.team === _epAlly && !_cc.isDead && _cc.hp > 0;
                        });
                        if (_pallies.length > 0) {
                            const _rAlly = _pallies[Math.floor(Math.random() * _pallies.length)];
                            gameState.characters[_rAlly].charges = Math.min(20, (gameState.characters[_rAlly].charges||0) + 2);
                            addLog('⚡ Emperador de la Galaxia: ' + _rAlly + ' +2 cargas (enemigo recibió buff)', 'buff');
                        }
                        break;
                    }
                }
            }
        }


        function isImmuneToDebuff(targetName) {
            // Saitama: total debuff immunity
            if ((targetName === 'Saitama' || targetName === 'Saitama v2')) return true;
            // Superman Forma Prime: debuff immunity
            const _spChar = gameState.characters[targetName];
            if (_spChar && _spChar.supermanPrimeMode) return true;

            // Proteccion Sagrada: immune to new debuffs
            if (hasStatusEffect(targetName, 'Proteccion Sagrada') || hasStatusEffect(targetName, 'Protección Sagrada')) return true;
            // LIMBO (Madara Uchiha): Divinidad = inmune a debuffs en Modo Rikudō
            const limboChar = gameState.characters[targetName];
            if (limboChar && limboChar.passive && limboChar.passive.name === 'Limbo' && limboChar.rikudoMode) return true;
            // MAESTRÍA DE LA VARITA DE SAÚCO (Albus Dumbledore): inmune a todos los debuffs
            if (limboChar && limboChar.passive && limboChar.passive.name === 'Maestría de la Varita de Saúco') return true;
            return false;
        }
        function isImmuneToBurn(targetName) {
            // Daenerys: immune to Quemadura and Quemadura Solar
            if ((targetName === 'Daenerys Targaryen' || targetName === 'Daenerys Targaryen v2')) return true;
            if ((targetName === 'Saitama' || targetName === 'Saitama v2')) return true;
            if (hasStatusEffect(targetName, 'Proteccion Sagrada') || hasStatusEffect(targetName, 'Protección Sagrada')) return true;
            { const _aC = gameState.characters[targetName];
              if (_aC && _aC.passive && _aC.passive.name === 'Monarca de la Destruccion') return true;
              if (_aC && _aC.passive && _aC.passive.name === 'Invierno Eterno') return true;
              if (_aC && _aC.passive && _aC.passive.name === 'Maestría de la Varita de Saúco') return true;
              if (_aC && (_aC.equippedRelics||[]).includes('Ignifugoz')) return true; }
            return false;
        }
function applyDebuff(targetName, effectObj) {
            const target = gameState.characters[targetName];
            if (!target || !target.statusEffects) return;
            // SABIDURÍA ANTIGUA (Yoda): inmune a todos los debuffs
            if (target.passive && target.passive.name === 'Sabiduría Antigua') {
                addLog('🟢 Sabiduría Antigua: ' + targetName + ' es inmune a debuffs', 'buff');
                return;
            }
            // MAESTRÍA DE LA VARITA DE SAÚCO (Albus Dumbledore): inmune a TODOS los debuffs
            if (target.passive && target.passive.name === 'Maestría de la Varita de Saúco') {
                addLog('✨ Maestría de la Varita de Saúco: ' + targetName + ' es inmune a debuffs', 'buff');
                return;
            }
            // CABALLERO DE LA NOCHE (Batman): inmune a efectos de movimientos especiales
            if (!passiveExecuting && gameState.selectedAbility && gameState.selectedAbility.type === 'special') {
                if (target.passive && target.passive.name === 'Caballero de la Noche') {
                    addLog('🦇 Caballero de la Noche: Batman es inmune a efectos del especial de ' + (gameState.selectedCharacter||'enemigo'), 'buff');
                    return;
                }
            }
            // ABSOLUTE ZERO (Sub-Zero): inmune a Congelación y Megacongelación (siempre)
            if (target.passive && target.passive.name === 'Absolute Zero') {
                if (effectObj) {
                    const _szEffL = (effectObj.name||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
                    if (_szEffL === 'congelacion' || _szEffL === 'megacongelacion') {
                        addLog('❄️ Absolute Zero: ' + targetName + ' es inmune a ' + effectObj.name, 'buff');
                        return;
                    }
                }
                // Full immunity while ICE CLON is active
                if (target._iceClonActive) {
                    addLog('🧊 ICE CLON: ' + targetName + ' es inmune a debuffs (ICE CLON activo)', 'buff');
                    return;
                }
            }
            // PIEL DE NANOOK (Bjorn): inmune a Congelación y MegaCongelación
            if (target.passive && target.passive.name === 'Piel de Nanook') {
                if (effectObj && (effectObj.name === 'Congelacion' || effectObj.name === 'Mega Congelacion' ||
                    effectObj.name === 'Congelación' || effectObj.name === 'Mega Congelación')) {
                    addLog('🐻 Piel de Nanook: ' + targetName + ' es inmune a Congelación', 'buff');
                    return;
                }
            }
            // IGNIFUGOZ (Armadura): inmune a Quemadura y Quemadura Solar
            if ((target.equippedRelics||[]).some(function(r){ return r === 'Ignifugoz'; })) {
                if (effectObj && (effectObj.name === 'Quemadura' || effectObj.name === 'Quemadura Solar' ||
                    effectObj.name === 'quemadura' || effectObj.name === 'quemadura solar')) {
                    addLog('🔥 Ignifugoz: ' + targetName + ' es inmune a Quemadura', 'buff');
                    return;
                }
            }
            // REY DE LA MUERTE (Lich King): genera 5 cargas por cada debuff aplicado al equipo enemigo
            if (typeof gameState !== 'undefined' && gameState.characters) {
                var _lkDebuffChar = null;
                var _targetChar2 = gameState.characters[targetName];
                if (_targetChar2) {
                    for (var _lkn in gameState.characters) {
                        var _lkc = gameState.characters[_lkn];
                        if (!_lkc || _lkc.isDead || !_lkc.passive || _lkc.passive.name !== 'Rey de la Muerte') continue;
                        if (_lkc.team !== _targetChar2.team) {
                            _lkc.charges = Math.min(20, (_lkc.charges||0) + 5);
                            // silent - no log spam
                        }
                    }
                }
            }
            // ANILLO DE LA VERDAD (debuff_resist_15): 15% de resistir cualquier debuff
            if ((target.equippedRelics||[]).some(function(r){ return r === 'Anillo de la Verdad'; })) {
                if (Math.random() < 0.15) {
                    addLog('💍 Anillo de la Verdad: ' + targetName + ' resiste el debuff "' + (effectObj.name||'') + '" (15%)', 'buff');
                    return;
                }
            }
            // BUFF REFLEJAR: el portador es inmune a nuevos debuffs mientras Reflejar esté activo
            if (hasStatusEffect(targetName, 'Reflejar')) {
                addLog('🪞 Reflejar: ' + targetName + ' es inmune al debuff (Reflejar activo)', 'buff');
                return;
            }
            // ESQUIVA ÁREA: inmune a TODOS los debuffs y efectos AOE de enemigos
            // También bloquea debuffs de movimientos NO-AOE si el objetivo tiene Esquiva Area activa
            if (gameState.selectedAbility && gameState.selectedCharacter) {
                const _attacker = gameState.characters[gameState.selectedCharacter];
                const _isEnemyAttack = _attacker && _attacker.team !== target.team;
                const _isAOEOrAll = gameState.selectedAbility.target === 'aoe' ||
                    gameState.selectedAbility.target === 'team' ||
                    gameState.selectedAbility.target === 'multi';
                if (_isEnemyAttack) {
                    // Esquiva Área bloquea debuffs de ataques AOE/multi Y debuffs de cualquier ataque
                    if (_isAOEOrAll && (checkAsprosAOEImmunity(targetName, true) || checkMinatoAOEImmunity(targetName))) {
                        addLog('💨 Esquiva Area: ' + targetName + ' esquiva el debuff AOE', 'buff');
                        return;
                    }
                }
            }
            // MEGA PROVOCACIÓN: solo el portador puede recibir debuffs AOE
            if (gameState.selectedAbility && (gameState.selectedAbility.target === 'aoe' || gameState.selectedAbility.target === 'team')) {
                const _attacker = gameState.characters[gameState.selectedCharacter];
                if (_attacker && _attacker.team !== target.team) {
                    // MEGA PROVOCACIÓN: solo el portador de MegaProv puede recibir debuffs/buffs AOE del enemigo
                    const _mpDebData = (typeof checkKamishMegaProvocation === 'function')
                        ? checkKamishMegaProvocation(target.team)
                        : null;
                    if (_mpDebData) {
                        // Determine if targetName is the MegaProv holder
                        let _isHolder = false;
                        if (_mpDebData.isCharacter && targetName === _mpDebData.characterName) _isHolder = true;
                        // For summon holders: the debuff would go to the summon (handled by applyDebuff on summon)
                        // For character holders: only they can receive the debuff
                        if (!_isHolder && _mpDebData.isCharacter) {
                            addLog('🎯 Mega Provocación: ' + targetName + ' es inmune al debuff/buff AOE (solo ' + _mpDebData.characterName + ' puede ser afectado)', 'buff');
                            return;
                        }
                    }
                }
            }
            // ABU EL-HOL SPHINX: Ozymandias inmune a debuffs cuando está activa
            if (effectObj && effectObj.type === 'debuff' && gameState && gameState.summons) {
                const _hasSphinx = Object.values(gameState.summons).some(function(s) {
                    return s && (s.name === 'Abu el-Hol Sphinx' || s.name === 'Sphinx Wehem-Mesut') &&
                        s.summoner === targetName && s.hp > 0;
                });
                if (_hasSphinx) {
                    addLog('🦁 Abu el-Hol Sphinx: ' + targetName + ' es inmune a debuffs', 'buff');
                    return;
                }
            }
            // Proteccion Sagrada bloquea todos los debuffs
            if (hasStatusEffect(targetName, 'Proteccion Sagrada')) {
                addLog(`🛡️ ${targetName} es inmune a debuffs (Protección Sagrada)`, 'buff');
                return;
            }
            // IMMUNIDADES POR PERSONAJE (pasivas)
            const targetChar = gameState.characters[targetName];
            if (targetChar) {
                // Saitama: inmune a todos los debuffs
                if ((targetName === 'Saitama' || targetName === 'Saitama v2') && effectObj.type === 'debuff') {
                    addLog(`🦸 Saitama es inmune a ${effectObj.name} (Espíritu del Héroe)`, 'buff');
                    return;
                }
                // DIVINIDAD: 50% limpiar debuff entrante, +2 cargas por limpiado
                if (effectObj.type === 'debuff' && hasStatusEffect(targetName, 'Divinidad') && Math.random() < 0.5) {
                    targetChar.charges = Math.min(20, (targetChar.charges || 0) + 2);
                    addLog('✨ Divinidad: ' + targetName + ' limpia ' + (effectObj.name || 'debuff') + ' y gana 2 cargas', 'buff');
                    return;
                }
                const effN = normAccent(effectObj.name || '');
                // Inmune a Miedo
                if (targetChar.immuneToMiedo && (effN === 'miedo')) {
                    addLog(`🛡️ ${targetName} es inmune a ${effectObj.name}`, 'buff');
                    return;
                }
                // Inmune a Confusión
                if (targetChar.immuneToConfusion && (effN === 'confusion')) {
                    addLog(`🛡️ ${targetName} es inmune a ${effectObj.name}`, 'buff');
                    return;
                }
                // Inmune a Posesión y Mega Posesión
                if (targetChar.immuneToPosesion && (effN === 'posesion' || effN === 'mega posesion')) {
                    addLog(`🛡️ ${targetName} es inmune a ${effectObj.name}`, 'buff');
                    return;
                }
                // Inmune a Congelación
                if (targetChar.immuneToCongelacion && (effN === 'congelacion' || effN === 'mega congelacion')) {
                    addLog(`❄️ Aura de Hielo: ${targetName} es inmune a ${effectObj.name}`, 'buff');
                    return;
                }
            }
            // NON-STACKABLE debuffs: block if target already has this debuff active
            const effNorm = normAccent(effectObj.name || '');
            if (NON_STACKABLE_DEBUFFS.includes(effNorm)) {
                const alreadyHas = target.statusEffects.some(e => e && normAccent(e.name || '') === effNorm);
                if (alreadyHas) {
                    addLog('⚠️ ' + targetName + ' ya tiene ' + effectObj.name + ' activo — no se puede aplicar de nuevo', 'info');
                    return;
                }
            }
            target.statusEffects.push(effectObj);

            // ── PASIVAS DINÁMICAS: AL_RECIBIR_DEBUFF ──
            if (!passiveExecuting && effectObj && effectObj.type === 'debuff' && !effectObj.passiveHidden && typeof runDynamicPassives === 'function') {
                const _dynDBChar = gameState.characters[targetName];
                if (_dynDBChar && _dynDBChar._isDynamic) {
                    runDynamicPassives('AL_RECIBIR_DEBUFF', {
                        charName: targetName, targetName,
                        allyTeam: _dynDBChar.team,
                        enemyTeam: _dynDBChar.team === 'team1' ? 'team2' : 'team1'
                    });
                }
            }

            // ── AURA DE LATVERIA (Doctor Doom): al recibir debuff → Protección Sagrada + disipa debuffs aliados + 3 cargas por debuff ──
            if (!passiveExecuting && effectObj && effectObj.type === 'debuff' && !effectObj.passiveHidden) {
                const _doomDbChar = gameState.characters[targetName];
                if (_doomDbChar && _doomDbChar.passive && _doomDbChar.passive.name === 'Aura de Latveria') {
                    passiveExecuting = true;
                    // Apply Protección Sagrada to Doctor Doom
                    applyDebuff(targetName, { name: 'Proteccion Sagrada', type: 'buff', duration: 2, emoji: '🛡️✨' });
                    // Cleanse all debuffs from allied team and count them
                    let _doomDisipados = 0;
                    for (const _aln in gameState.characters) {
                        const _alc = gameState.characters[_aln];
                        if (!_alc || _alc.isDead || _alc.hp <= 0 || _alc.team !== _doomDbChar.team) continue;
                        const _debuffsBefore = (_alc.statusEffects||[]).filter(function(e){ return e && e.type === 'debuff'; }).length;
                        if (_debuffsBefore > 0) {
                            _alc.statusEffects = (_alc.statusEffects||[]).filter(function(e){ return !e || e.type !== 'debuff'; });
                            _doomDisipados += _debuffsBefore;
                        }
                    }
                    // +3 cargas por debuff disipado
                    if (_doomDisipados > 0) {
                        _doomDbChar.charges = Math.min(20, (_doomDbChar.charges||0) + _doomDisipados * 3);
                        addLog('🌩️ Aura de Latveria: Doctor Doom disipa ' + _doomDisipados + ' debuff(s) aliados y genera ' + (_doomDisipados*3) + ' cargas', 'buff');
                    }
                    addLog('🌩️ Aura de Latveria: Doctor Doom recibe Protección Sagrada (recibió debuff)', 'buff');
                    passiveExecuting = false;
                }
            }

            // ── DAGA DE KAISEL: al recibir un debuff → aplica ese mismo debuff a un enemigo aleatorio y le quita 2 cargas ──
            if (!passiveExecuting && effectObj && effectObj.type === 'debuff' && !effectObj.passiveHidden) {
                const _dkChar = gameState.characters[targetName];
                if (_dkChar && (_dkChar.equippedRelics||[]).includes('Daga de Kaisel')) {
                    // Buscar enemigos del portador
                    const _dkETeam = _dkChar.team === 'team1' ? 'team2' : 'team1';
                    const _dkEnemies = Object.keys(gameState.characters).filter(function(n){
                        const _c = gameState.characters[n];
                        return _c && _c.team === _dkETeam && !_c.isDead && _c.hp > 0;
                    });
                    if (_dkEnemies.length > 0) {
                        passiveExecuting = true;
                        const _dkTarget = _dkEnemies[Math.floor(Math.random() * _dkEnemies.length)];
                        const _dkDebuffCopy = Object.assign({}, effectObj); // copia del debuff recibido
                        applyDebuff(_dkTarget, _dkDebuffCopy);
                        const _dkTgtChar = gameState.characters[_dkTarget];
                        if (_dkTgtChar) _dkTgtChar.charges = Math.max(0, (_dkTgtChar.charges||0) - 2);
                        addLog('🗡️ Daga de Kaisel: ' + effectObj.name + ' reflejado a ' + _dkTarget + ' y pierde 2 cargas', 'debuff');
                        passiveExecuting = false;
                    }
                }
            }

            // ── ORGULLO VILTRUMITA (Omni-Man): si un aliado recibe un debuff → Arremetida Planetaria ──
            if (!effectObj.passiveHidden) {
                const _ovDebuffTgt = gameState.characters[targetName];
                if (_ovDebuffTgt) {
                    for (const _omN in gameState.characters) {
                        const _omC = gameState.characters[_omN];
                        if (!_omC || _omC.isDead || _omC.hp <= 0 || !_omC.passive) continue;
                        if (_omC.passive.name !== 'Orgullo Viltrumita') continue;
                        if (_omC.team !== _ovDebuffTgt.team) continue; // solo si el debuff fue al equipo de Omni-Man
                        if (_omN === (gameState.selectedCharacter)) continue; // no trigger si Omni-Man se lo aplica a sí mismo
                        // Ejecutar Arremetida Planetaria automáticamente
                        if (!gameState._omniManPassiveExecuting) {
                            gameState._omniManPassiveExecuting = true;
                            try {
                                const _omET = _omC.team === 'team1' ? 'team2' : 'team1';
                                const _omAliveEnemies = Object.keys(gameState.characters).filter(function(n) {
                                    const _c = gameState.characters[n];
                                    return _c && _c.team === _omET && !_c.isDead && _c.hp > 0;
                                });
                                if (_omAliveEnemies.length > 0) {
                                    addLog('🦸 Orgullo Viltrumita: Omni-Man ejecuta Arremetida Planetaria (debuff aplicado a aliado)', 'buff');
                                    const _omArrDmg = 1;
                                    for (const _en in gameState.characters) {
                                        const _ec = gameState.characters[_en];
                                        if (!_ec || _ec.team !== _omET || _ec.isDead || _ec.hp <= 0) continue;
                                        if (typeof checkAsprosAOEImmunity === 'function' && checkAsprosAOEImmunity(_en, true)) continue;
                                        let _omD = _omArrDmg;
                                        if (Math.random() < 0.10) { _omD += 6; addLog('💥 Arremetida Planetaria (pasiva): +6 en ' + _en, 'damage'); }
                                        if (typeof applyDamageWithShield === 'function') applyDamageWithShield(_en, _omD, _omN);
                                        if (Math.random() < 0.50) { if (typeof applyStun === 'function') applyStun(_en, 1); addLog('⭐ Arremetida Planetaria (pasiva): Aturdimiento en ' + _en, 'debuff'); }
                                    }
                                    // +1 carga a Omni-Man (chargeGain de Arremetida)
                                    _omC.charges = Math.min(20, (_omC.charges||0) + 1);
                                }
                            } catch(e) { console.error('[Orgullo Viltrumita]', e); }
                            gameState._omniManPassiveExecuting = false;
                        }
                        break;
                    }
                }
            }
            if (gameState.selectedCharacter && gameState.selectedAbility) {
                const _caster = gameState.characters[gameState.selectedCharacter];
                const _tgt = gameState.characters[targetName];
                if (_caster && _tgt && _caster.team !== _tgt.team && typeof registerDebuff === 'function') {
                    registerDebuff(gameState.selectedCharacter);
                }
            }
            // Animación debuff en el portador
            if (typeof _animCard === 'function') {
                _animCard(targetName, 'anim-debuff', 500);
            }
            // PASIVA MABOROSHI: Saga gana 1 carga al aplicar debuff en enemigo
            triggerMaboroshi(target.team, effectObj.name);
            // ARCHIMAGA DEL KIRIN TOR (Jaina): aplica Congelacion al enemigo que recibe debuff
            if (gameState.selectedCharacter && gameState.selectedCharacter !== targetName) {
                const _jainaAtk = gameState.characters[gameState.selectedCharacter];
                if (_jainaAtk && target && _jainaAtk.team !== target.team &&
                    _jainaAtk.passive && _jainaAtk.passive.name === 'Archimaga del Kirin Tor') {
                    const _dEffN = normAccent(effectObj.name||'');
                    if (_dEffN !== 'congelacion' && _dEffN !== 'mega congelacion') {
                        if (typeof applyFreeze === 'function') applyFreeze(targetName, 1);
                    }
                }
            }
            // LUNA SUPERIOR DOS (Douma): cura al aplicar Congelacion/Megacongelacion
            {
                const _lsdEffN = normAccent(effectObj.name||'');
                if (_lsdEffN === 'congelacion' || _lsdEffN === 'mega congelacion') {
                    if (typeof triggerLunaSuperiorDos === 'function') triggerLunaSuperiorDos(targetName, _lsdEffN === 'mega congelacion');
                }
            }
            // PASIVA PRÍNCIPE DE LOS SAYAJINS (Vegeta): 50% debuff miss chance
            {
                const _vegDebTarget = gameState.characters[targetName];
                if (_vegDebTarget && !_vegDebTarget.isDead && _vegDebTarget.hp > 0 &&
                    _vegDebTarget.passive && _vegDebTarget.passive.name === 'Príncipe de los Sayajins' &&
                    effectObj.type === 'debuff') {
                    if (Math.random() < 0.50) {
                        addLog('👑 Príncipe de los Sayajins: ' + targetName + ' evade el debuff ' + effectObj.name + ' (50%)', 'buff');
                        return; // debuff blocked
                    }
                }
            }

            // CÉLULAS DE HASHIRAMA (Madara): 50% de limpiar debuff al recibirlo (100% en Rikudō)
            {
                const _hashTarget = gameState.characters[targetName];
                if (_hashTarget && !_hashTarget.isDead && _hashTarget.hp > 0 &&
                    _hashTarget.passive && _hashTarget.passive.name === 'Células de Hashirama' &&
                    effectObj.type === 'debuff') {
                    const _hashChance = _hashTarget.rikudoMode ? 1.00 : 0.50;
                    if (Math.random() < _hashChance) {
                        _hashTarget.statusEffects = (_hashTarget.statusEffects || []).filter(e => e !== effectObj);
                        addLog('🌿 Células de Hashirama: ' + targetName + ' limpia ' + effectObj.name + (_hashTarget.rikudoMode ? ' (100% Rikudō)' : ' (50%)'), 'buff');
                        return;
                    }
                }
            }

            // PASIVA NEGOCIACIONES HOSTILES (Padme): aliado recibe debuff → Padme +1 carga
            {
                const padme = gameState.characters['Padme Amidala'] ||
                    Object.values(gameState.characters).find(c => c && (c.passive && c.passive.name === 'Negociaciones Hostiles') && c.team === target.team && !c.isDead && c.hp > 0);
                if (padme && !padme.isDead && padme.hp > 0 && effectObj.type === 'debuff') {
                    // Check if target is an ally of Padme (same team)
                    if (target.team === padme.team) {
                        padme.charges = Math.min(20, (padme.charges || 0) + 1);
                        addLog('🌹 Negociaciones Hostiles: Padmé gana 1 carga (' + padme.charges + ')', 'buff');
                    }
                }
            }

            // ── PASIVA DIOS DE LA GUERRA (Kratos): 50% limpia debuff + 2 buffs aleatorios ──
            if (!passiveExecuting && effectObj && effectObj.type === 'debuff') {
                const _kratosChar = gameState.characters[targetName];
                if (_kratosChar && !_kratosChar.isDead && _kratosChar.hp > 0 &&
                    _kratosChar.passive && _kratosChar.passive.name === 'Dios de la Guerra') {
                    if (Math.random() < 0.50) {
                        // Remove the debuff that was just applied
                        _kratosChar.statusEffects = (_kratosChar.statusEffects || []).filter(function(e){ return e !== effectObj; });
                        addLog('⚔️ Dios de la Guerra: ' + targetName + ' limpia ' + (effectObj.name||'debuff'), 'buff');
                        // Apply 2 random buffs
                        const KRATOS_BUFFS = [
                            { name: 'Furia', type: 'buff', duration: 2, emoji: '🔥' },
                            { name: 'Frenesi', type: 'buff', duration: 2, emoji: '⚡' },
                            { name: 'Armadura', type: 'buff', duration: 2, emoji: '🛡️' },
                            { name: 'Concentracion', type: 'buff', duration: 2, emoji: '🎯' },
                            { name: 'Contraataque', type: 'buff', duration: 2, emoji: '⚔️' },
                            { name: 'Celeridad', type: 'buff', duration: 2, emoji: '💨', speedBonus: 5 }
                        ];
                        var _shuffled = KRATOS_BUFFS.slice().sort(function(){ return Math.random()-0.5; });
                        for (var _ki = 0; _ki < 2; _ki++) {
                            var _kb = Object.assign({}, _shuffled[_ki]);
                            _kratosChar.statusEffects.push(_kb);
                            if (_kb.speedBonus) _kratosChar.speed = (_kratosChar.speed||88) + _kb.speedBonus;
                            addLog('⚔️ Dios de la Guerra: ' + targetName + ' gana buff ' + _kb.name, 'buff');
                        }
                        return; // debuff removed, no further processing
                    }
                }
            }

            // ── PASIVA IZANAMI PARTE B: via triggerIzanamiPartB helper ──
            if (effectObj && effectObj.type === 'debuff') {
                const _izTriggers2 = ['posesion', 'posesión', 'veneno', 'quemadura', 'quemaduras', 'confusion', 'confusión'];
                if (_izTriggers2.some(function(t){ return normAccent(effectObj.name||'').toLowerCase().includes(t); })) {
                    triggerIzanamiPartB(targetName);
                }
            }

            // ── PECADO DE LA IRA (Meliodas): cuando aliado recibe debuff → mirror en enemigo aleatorio ──
            if (!passiveExecuting && effectObj && target) {
                const _melTeam = target.team;
                for (const _mn in gameState.characters) {
                    const _melC = gameState.characters[_mn];
                    if (!_melC || _melC.isDead || _melC.team !== _melTeam) continue;
                    if (!_melC.passive || _melC.passive.name !== 'Pecado de la Ira') continue;
                    const _melETeam = _melTeam === 'team1' ? 'team2' : 'team1';
                    const _melEnemies = Object.keys(gameState.characters).filter(function(n){
                        const _ec = gameState.characters[n];
                        return _ec && _ec.team === _melETeam && !_ec.isDead && _ec.hp > 0;
                    });
                    if (!_melEnemies.length) break;
                    const _mirrorTarget = _melEnemies[Math.floor(Math.random()*_melEnemies.length)];
                    const _mirrorEff = Object.assign({}, effectObj);
                    passiveExecuting = true;
                    applyDebuff(_mirrorTarget, _mirrorEff);
                    passiveExecuting = false;
                    addLog('⚔️ Pecado de la Ira: ' + (effectObj.name||'debuff') + ' reflejado en ' + _mirrorTarget, 'debuff');
                    break;
                }
            }
        }

        function applyStun(targetName, duration = 1) {

            if (isImmuneToDebuff(targetName)) { addLog('🛡️ ' + targetName + ' es inmune a debuffs', 'buff'); return; }            const name = duration >= 2 ? 'Mega Aturdimiento' : 'Aturdimiento';
            const emoji = duration >= 2 ? '💫' : '⭐';
            applyDebuff(targetName, { name, type: 'debuff', duration, emoji });
            addLog(`${emoji} ${targetName} queda aturdido por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
            if (typeof registerCC === 'function' && gameState.selectedCharacter) registerCC(gameState.selectedCharacter);
        }

        function applyBleed(targetName, duration) {

            if (isImmuneToDebuff(targetName)) { addLog('🛡️ ' + targetName + ' es inmune a debuffs', 'buff'); return; }
            const _bleedTgt = gameState.characters[targetName];
            if (_bleedTgt && _bleedTgt.passive && _bleedTgt.passive.name === 'Invierno Eterno') { addLog('☠️ Invierno Eterno: Rey de la Noche es inmune a Sangrado', 'buff'); return; }
            const _bleedDuration = duration || 1; // Por defecto Sangrado 1T si la habilidad no especifica
            if (!_bleedTgt) return;
            // No se puede aplicar Sangrado sobre un personaje con Hemorragia activa
            const _hasHemorragia = (_bleedTgt.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'hemorragia'; });
            if (_hasHemorragia) {
                addLog(`🩸 ${targetName} ya tiene Hemorragia activa — no se puede aplicar Sangrado`, 'info');
                return;
            }
            // Si ya tiene Sangrado activo → ambos se eliminan y se aplica Hemorragia (permanente)
            const _existingBleed = (_bleedTgt.statusEffects||[]).find(function(e){ return e && normAccent(e.name||'') === 'sangrado'; });
            if (_existingBleed) {
                _bleedTgt.statusEffects = (_bleedTgt.statusEffects||[]).filter(function(e){ return !e || normAccent(e.name||'') !== 'sangrado'; });
                applyDebuff(targetName, { name: 'Hemorragia', type: 'debuff', duration: 999, permanent: true, emoji: '🩸💀' });
                addLog(`🩸💀 ${targetName} ya tenía Sangrado activo — ambos se eliminan y se aplica Hemorragia (permanente)`, 'damage');
                return;
            }
            applyDebuff(targetName, { name: 'Sangrado', type: 'debuff', duration: _bleedDuration, emoji: '🩸' });
            addLog(`🩸 ${targetName} sufre Sangrado por ${_bleedDuration} turno${_bleedDuration > 1 ? 's' : ''}`, 'damage');
        }

        function applyFear(targetName, duration) {
            if (isImmuneToDebuff(targetName)) { addLog('🛡️ ' + targetName + ' es inmune a debuffs', 'buff'); return; }
            const _fearTgt = gameState.characters[targetName];
            if (_fearTgt && _fearTgt.passive && _fearTgt.passive.name === 'Mente Brillante') { addLog('🪓 Mente Brillante: Ivar es inmune a Miedo', 'buff'); return; }
            if (_fearTgt && _fearTgt.passive && _fearTgt.passive.name === 'Señor de los Nazgul') { addLog('💀 Señor de los Nazgul: Rey Brujo es inmune a Miedo', 'buff'); return; }
            if (_fearTgt && _fearTgt.passive && _fearTgt.passive.name === 'Invierno Eterno') { addLog('☠️ Invierno Eterno: Rey de la Noche es inmune a Miedo', 'buff'); return; }
            applyDebuff(targetName, { name: 'Miedo', type: 'debuff', duration, emoji: '😱' });
            addLog(`😱 ${targetName} siente Miedo por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
        }

        function applyPossession(targetName, duration) {
            if (isImmuneToDebuff(targetName)) { addLog('🛡️ ' + targetName + ' es inmune a debuffs', 'buff'); return; }
            const _posTgt = gameState.characters[targetName];
            if (_posTgt && _posTgt.passive && _posTgt.passive.name === 'Mente Brillante') { addLog('🪓 Mente Brillante: Ivar es inmune a Posesión', 'buff'); return; }
            applyDebuff(targetName, { name: 'Posesion', type: 'debuff', duration, emoji: '👁️' });
            addLog(`👁️ ${targetName} queda Poseído por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
        }

        function applyHolyShield(targetName, duration) {
            // Es un buff, no requiere verificación de Protección Sagrada
            const target = gameState.characters[targetName];
            if (!target) return;
            target.statusEffects.push({ name: 'Escudo Sagrado', type: 'buff', duration, emoji: '✝️' });
            addLog(`✝️ ${targetName} recibe Escudo Sagrado por ${duration} turno${duration > 1 ? 's' : ''}`, 'buff');
        }

        function applyHolyProtection(targetName, duration) {
            const target = gameState.characters[targetName];
            if (!target) return;
            target.statusEffects.push({ name: 'Proteccion Sagrada', type: 'buff', duration, emoji: '🛡️' });
            addLog(`🛡️ ${targetName} recibe Protección Sagrada (inmune a debuffs) por ${duration} turno${duration > 1 ? 's' : ''}`, 'buff');
        }

        function applyMegaFreeze(targetName, duration) {
            applyFreeze(targetName, duration, true);
        }

        function applyFreeze(targetName, duration, mega = false) {

            if (isImmuneToDebuff(targetName)) { addLog('🛡️ ' + targetName + ' es inmune a debuffs', 'buff'); return; }            const name = mega ? 'Mega Congelacion' : 'Congelacion';
            const emoji = mega ? '🧊❄️' : '❄️';
            const speedPenalty = mega ? 0.20 : 0.10;
            const target = gameState.characters[targetName];
            if (!target) return;

            // Arco Granizo: al aplicar Congelación (no Mega) → +1 carga al atacante
            if (!mega) {
                var _afAttacker = gameState._currentTurnAttacker || gameState.selectedCharacter;
                if (_afAttacker && _afAttacker !== targetName) {
                    var _afChar = gameState.characters[_afAttacker];
                    if (_afChar && (_afChar.equippedRelics||[]).some(function(r){ return r === 'Arco Granizo'; })) {
                        _afChar.charges = Math.min(20, (_afChar.charges||0) + 1);
                        addLog('🏹 Arco Granizo: ' + _afAttacker + ' gana 1 carga por congelar a ' + targetName, 'buff');
                    }
                }
            }
            // Guardar velocidad base antes de penalizar
            const _freezeBaseSpeed = target.baseSpeed || target.speed;
            target.baseSpeed = _freezeBaseSpeed;
            const _freezeActualPenalty = Math.floor(_freezeBaseSpeed * speedPenalty);
            applyDebuff(targetName, { name, type: 'debuff', duration, emoji, speedPenalty, speedPenaltyFlat: _freezeActualPenalty });
            // Reducir velocidad (se restaurará cuando expire el debuff)
            target.speed = Math.max(1, target.speed - _freezeActualPenalty);
            addLog(emoji + ' ' + targetName + ' queda ' + (mega ? 'Mega Congelado' : 'Congelado') + ' (vel -' + _freezeActualPenalty + ') por ' + duration + ' turno' + (duration > 1 ? 's' : ''), 'damage');

            // ── INVIERNO ETERNO (Rey de la Noche): 2 daño directo al objetivo cuando su equipo aplica Congelacion/Megacongelacion ──
            if (!passiveExecuting) {
                const _tgtRDN = gameState.characters[targetName];
                if (_tgtRDN) {
                    // Buscar al Rey de la Noche en el equipo contrario al objetivo
                    const _rdnEnemyTeam = _tgtRDN.team;
                    const _rdnAllyTeam = _rdnEnemyTeam === 'team1' ? 'team2' : 'team1';
                    for (const _rdnN in gameState.characters) {
                        const _rdnC = gameState.characters[_rdnN];
                        if (!_rdnC || _rdnC.isDead || _rdnC.hp <= 0 || _rdnC.team !== _rdnAllyTeam) continue;
                        if (_rdnC.passive && _rdnC.passive.name === 'Invierno Eterno') {
                            passiveExecuting = true;
                            _tgtRDN.hp = Math.max(0, (_tgtRDN.hp||0) - 2);
                            if (_tgtRDN.hp <= 0) { _tgtRDN.isDead = true; if (typeof registerKill === 'function') registerKill('Rey de la Noche', targetName, false); }
                            addLog('☠️ Invierno Eterno: ' + _rdnN + ' inflige 2 daño directo a ' + targetName + ' (congelación aplicada)', 'damage');
                            passiveExecuting = false;
                            break;
                        }
                    }
                }
            }

            // ── ÚLTIMO REY DE LOS MUERTOS (Bolvar BOSS): escudo al aplicar Congelación (3 HP) o Megacongelación (10 HP) ──
            if (!passiveExecuting) {
                for (const _brvN in gameState.characters) {
                    const _brvC = gameState.characters[_brvN];
                    if (!_brvC || _brvC.isDead || _brvC.hp <= 0 || !_brvC.passive) continue;
                    if (_brvC.passive.name !== 'Último Rey de los Muertos') continue;
                    const _brvShield = mega ? 10 : 3;
                    if (typeof applyShield === 'function') applyShield(_brvN, _brvShield, 'bolvar_boss_shield');
                    else _brvC.shield = (_brvC.shield||0) + _brvShield;
                    addLog('💀 Último Rey de los Muertos: Bolvar recibe escudo +' + _brvShield + ' HP (' + (mega ? 'Megacongelación' : 'Congelación') + ' aplicada)', 'buff');
                    break;
                }
            }

            // ── EL CARCELERO DE LOS MALDITOS (Bolvar PERSONAJE): team heal o maxHp al aplicar Congelación/Megacongelación ──
            if (!passiveExecuting) {
                for (const _bpN in gameState.characters) {
                    const _bpC = gameState.characters[_bpN];
                    if (!_bpC || _bpC.isDead || _bpC.hp <= 0 || !_bpC.passive) continue;
                    if (_bpC.passive.name !== 'El Carcelero de los Malditos') continue;
                    passiveExecuting = true;
                    if (mega) {
                        // Megacongelación: equipo aliado +3 HP máximo permanente
                        for (const _aln in gameState.characters) {
                            const _alc = gameState.characters[_aln];
                            if (!_alc || _alc.isDead || _alc.hp <= 0 || _alc.team !== _bpC.team) continue;
                            _alc.maxHp = (_alc.maxHp||0) + 3;
                            addLog('🧊 El Carcelero de los Malditos: ' + _aln + ' HP máximo +3 (Megacongelación)', 'buff');
                        }
                    } else {
                        // Congelación: equipo aliado se cura 3 HP
                        for (const _aln in gameState.characters) {
                            const _alc = gameState.characters[_aln];
                            if (!_alc || _alc.isDead || _alc.hp <= 0 || _alc.team !== _bpC.team) continue;
                            if (typeof applyHeal === 'function') applyHeal(_aln, 3, 'El Carcelero de los Malditos');
                            else _alc.hp = Math.min(_alc.maxHp, (_alc.hp||0) + 3);
                        }
                        addLog('❄️ El Carcelero de los Malditos: equipo aliado +3 HP (Congelación aplicada)', 'heal');
                    }
                    passiveExecuting = false;
                    break;
                }
            }
        }

        function applyPoison(targetName, stacks) {
            const target = gameState.characters[targetName];
            if (!target) return;
            if (isImmuneToDebuff(targetName)) { addLog('🛡️ ' + targetName + ' es inmune a debuffs', 'buff'); return; }
            // MVP: registrar quién aplica veneno
            if (gameState.battleStats && gameState.selectedCharacter) {
                if (!gameState.battleStats.poisonAppliers) gameState.battleStats.poisonAppliers = new Set();
                gameState.battleStats.poisonAppliers.add(gameState.selectedCharacter);
            }
            // DONCELLA ESCUDERA (Lagertha): inmune a Veneno
            if (target.passive && target.passive.name === 'Doncella Escudera') {
                addLog('🛡️ Doncella Escudera: Lagertha es inmune a Veneno', 'buff');
                return;
            }
            const _poisonStacks = stacks || 1;
            // VENENO STACKEABLE: un solo debuff que acumula stacks. Daño = total de stacks, calculado UNA VEZ al final de ronda.
            const existing = (target.statusEffects || []).find(e => e && normAccent(e.name||'') === 'veneno');
            if (existing) {
                existing.poisonStacks = (existing.poisonStacks || 0) + _poisonStacks;
                addLog(`☠️ ${targetName} acumula +${_poisonStacks} stack(s) de Veneno (total: ${existing.poisonStacks}S)`, 'damage');
            } else {
                applyDebuff(targetName, { name: 'Veneno', type: 'debuff', duration: 999, permanent: true, emoji: '☠️', poisonStacks: _poisonStacks });
                addLog(`☠️ ${targetName} es envenenado (Veneno ${_poisonStacks}S)`, 'damage');
            }
            if (typeof triggerIzanamiPartB === 'function') triggerIzanamiPartB(targetName);

            // ── PROGENITOR DEMONIACO (Muzan): +1 carga por cada stack de Veneno aplicado ──
            if (!passiveExecuting && _poisonStacks > 0) {
                const _targetC = gameState.characters[targetName];
                if (_targetC) {
                    for (const _mzN in gameState.characters) {
                        const _mzC = gameState.characters[_mzN];
                        if (!_mzC || _mzC.isDead || !_mzC.passive || _mzC.passive.name !== 'Progenitor Demoniaco') continue;
                        if (_mzC.team === _targetC.team) continue; // Muzan must be on the attacking team
                        _mzC.charges = Math.min(20, (_mzC.charges||0) + _poisonStacks);
                        addLog('👹 Progenitor Demoniaco: Muzan +' + _poisonStacks + ' carga(s) (Veneno aplicado a ' + targetName + ')', 'buff');
                        break;
                    }
                }
            }

            // SEÑOR DE LOS NAZGUL (Rey Brujo): cura 2 HP al aplicar Veneno en un enemigo
            if (!passiveExecuting) {
                for (const _rbN in gameState.characters) {
                    const _rbC = gameState.characters[_rbN];
                    if (!_rbC || _rbC.isDead || !_rbC.passive) continue;
                    if (_rbC.passive.name !== 'Señor de los Nazgul') continue;
                    // Verificar que el objetivo es enemigo del Rey Brujo
                    const _rbTarget = gameState.characters[targetName];
                    if (!_rbTarget || _rbTarget.team === _rbC.team) continue;
                    passiveExecuting = true;
                    if (typeof applyHeal === 'function') applyHeal(_rbN, 2, 'Señor de los Nazgul');
                    else _rbC.hp = Math.min(_rbC.maxHp, (_rbC.hp||0) + 2);
                    addLog('💀 Señor de los Nazgul: Rey Brujo se cura 2 HP (Veneno aplicado a enemigo)', 'heal');
                    passiveExecuting = false;
                    break;
                }
            }
        }


        function applyWeaken(targetName, duration) {

            if (isImmuneToDebuff(targetName)) { addLog('🛡️ ' + targetName + ' es inmune a debuffs', 'buff'); return; }            applyDebuff(targetName, { name: 'Debilitar', type: 'debuff', duration, emoji: '💔' });
            addLog(`💔 ${targetName} sufre Debilitar por ${duration} turno${duration > 1 ? 's' : ''} (recibe 50% más de daño)`, 'damage');
        }

        function applyConfusion(targetName, duration) {
            if (isImmuneToDebuff(targetName)) { addLog('🛡️ ' + targetName + ' es inmune a debuffs', 'buff'); return; }
            const tgtConf = gameState.characters[targetName];
            if (!tgtConf) return;
            // MENTE BRILLANTE (Ivar): inmune a Confusión
            if (tgtConf.passive && tgtConf.passive.name === 'Mente Brillante') { addLog('🪓 Mente Brillante: Ivar es inmune a Confusión', 'buff'); return; }
            // SEÑOR DE LOS NAZGUL (Rey Brujo): inmune a Confusión
            if (tgtConf.passive && tgtConf.passive.name === 'Señor de los Nazgul') { addLog('💀 Señor de los Nazgul: Rey Brujo es inmune a Confusión', 'buff'); return; }
            if (tgtConf.statusEffects) {
                tgtConf.statusEffects = tgtConf.statusEffects.filter(e => !e || normAccent(e.name || '') !== 'confusion');
            }
            applyDebuff(targetName, { name: 'Confusion', type: 'debuff', duration, emoji: '😵' });
            addLog(`😵 ${targetName} queda Confundido por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
            if (typeof triggerIzanamiPartB === 'function') triggerIzanamiPartB(targetName);
        }
        // Quemadura Solar: stackeable (a diferencia de Quemadura normal)
        function applySolarBurn(targetName, durationOrPercent, duration) {
            // QS ahora funciona por TURNOS (bloquea curación). percent ignorado.
            // Para compatibilidad backward: si se llama con (name, percent, duration), usar duration
            const target = gameState.characters[targetName];
            if (!target || !target.statusEffects) return;
            // MAESTRÍA DE LA VARITA DE SAÚCO (Dumbledore) / IGNIFUGOZ: inmune a Quemadura Solar
            if (target.passive && target.passive.name === 'Maestría de la Varita de Saúco') {
                addLog('✨ Maestría de la Varita de Saúco: ' + targetName + ' es inmune a Quemadura Solar', 'buff');
                return;
            }
            if ((target.equippedRelics||[]).includes('Ignifugoz')) {
                addLog('🔥 Ignifugoz: ' + targetName + ' es inmune a Quemadura Solar', 'buff');
                return;
            }
            if (hasStatusEffect(targetName, 'Proteccion Sagrada') || hasStatusEffect(targetName, 'Protección Sagrada')) {
                addLog(`🛡️ ${targetName} es inmune a Quemadura Solar (Protección Sagrada)`, 'buff');
                return;
            }
            if ((targetName === 'Daenerys Targaryen' || targetName === 'Daenerys Targaryen v2')) {
                addLog('🐉 Dynastía del Dragón: Daenerys es inmune a Quemadura Solar', 'buff');
                if (typeof triggerDaenerysPassiveBurnHeal === 'function') triggerDaenerysPassiveBurnHeal('Daenerys Targaryen');
                return;
            }
            if ((targetName === 'Saitama' || targetName === 'Saitama v2')) {
                addLog('🦸 Saitama es inmune a Quemadura Solar', 'buff');
                return;
            }
            // Antares: Monarca de la Destruccion — inmune a Quemadura Solar
            { const _antC = gameState.characters[targetName];
              if (_antC && _antC.passive && _antC.passive.name === 'Monarca de la Destruccion') {
                addLog('🐉 Monarca de la Destruccion: Antares es inmune a Quemadura Solar', 'buff'); return; } }
            // QS: debuff por TURNOS. Solo bloquea curación, no hace daño por %
            // Si ya tiene QS activa, reemplazar
            target.statusEffects = (target.statusEffects || []).filter(e => !e || e.name !== 'Quemadura Solar');
            target.statusEffects.push({ name: 'Quemadura Solar', type: 'debuff', duration: duration, emoji: '☀️' });
            addLog('☀️ ' + targetName + ' recibe Quemadura Solar ' + duration + 'T (no puede recuperar HP)', 'damage');
            // PRIVILEGIO IMPERIAL (Ozymandias): genera 1 carga cuando QS es aplicada sobre un enemigo
            if (!passiveExecuting) {
                for (const _ozn in gameState.characters) {
                    const _ozc = gameState.characters[_ozn];
                    if (!_ozc || _ozc.isDead || _ozc.hp <= 0) continue;
                    if (!_ozc.passive || _ozc.passive.name !== 'Privilegio Imperial') continue;
                    if (_ozc.team === target.team) continue; // Ozymandias debe ser enemigo del objetivo
                    _ozc.charges = Math.min(20, (_ozc.charges||0) + 1);
                    addLog('☀️ Privilegio Imperial: Ozymandias genera 1 carga (QS aplicada)', 'buff');
                    break;
                }
                // ORGULLO DEL LEÓN (Escanor): 50% de ganar 1 carga al aplicar QS a un enemigo
                for (const _esn in gameState.characters) {
                    const _esc = gameState.characters[_esn];
                    if (!_esc || _esc.isDead || _esc.hp <= 0) continue;
                    if (!_esc.passive || _esc.passive.name !== 'Orgullo del León') continue;
                    if (_esc.team === target.team) continue; // Escanor enemigo del objetivo
                    if (Math.random() < 0.50) {
                        _esc.charges = Math.min(20, (_esc.charges||0) + 1);
                        addLog('🦁 Orgullo del León: Escanor gana 1 carga (QS aplicada, 50%)', 'buff');
                    }
                    break;
                }
                // DRAGON ALADO DE RA: al aplicar QS, 2 daño directo a todos los enemigos
                for (const _drid in gameState.summons) {
                    const _drs = gameState.summons[_drid];
                    if (!_drs || _drs.name !== 'Dragon Alado de Ra' || _drs.hp <= 0) continue;
                    if (_drs.team === target.team) continue; // Dragon es aliado del atacante
                    passiveExecuting = true;
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== target.team || _c.isDead || _c.hp <= 0) continue;
                        _c.hp = Math.max(0, (_c.hp||0) - 2);
                        if (_c.hp <= 0) { _c.isDead = true; if (typeof registerKill === 'function') registerKill(gameState.selectedCharacter||'Escanor', _n, false); }
                    }
                    passiveExecuting = false;
                    addLog('🐉 Fuego de Egipto: 2 daño directo a todos los enemigos (QS aplicada)', 'damage');
                    break;
                }
                // HUEVO DEL SOL: recibe 2 daño cada vez que se aplica QS
                for (const _hsid in gameState.summons) {
                    const _hs = gameState.summons[_hsid];
                    if (!_hs || _hs.name !== 'Huevo del Sol' || _hs.hp <= 0) continue;
                    if (_hs.team !== target.team) continue; // El huevo está en el equipo del objetivo
                    _hs.hp = Math.max(0, (_hs.hp||0) - 2);
                    addLog('🌞 Nacimiento Solar: Huevo del Sol recibe 2 daño (QS aplicada) [' + _hs.hp + ' HP]', 'damage');
                    if (_hs.hp <= 0 && typeof removeSummon === 'function') {
                        removeSummon(_hsid, 'derrotado');
                    }
                    break;
                }
            }

            // ── ÚLTIMO REY DE LOS MUERTOS (Bolvar BOSS): escudo +10 HP al aplicar Quemadura Solar ──
            if (!passiveExecuting) {
                for (const _brvSN in gameState.characters) {
                    const _brvSC = gameState.characters[_brvSN];
                    if (!_brvSC || _brvSC.isDead || _brvSC.hp <= 0 || !_brvSC.passive) continue;
                    if (_brvSC.passive.name !== 'Último Rey de los Muertos') continue;
                    if (typeof applyShield === 'function') applyShield(_brvSN, 10, 'bolvar_boss_shield');
                    else _brvSC.shield = (_brvSC.shield||0) + 10;
                    addLog('💀 Último Rey de los Muertos: Bolvar recibe escudo +10 HP (Quemadura Solar aplicada)', 'buff');
                    break;
                }
            }

            // ── EL CARCELERO DE LOS MALDITOS (Bolvar PERSONAJE): equipo aliado +3 HP máximo al aplicar Quemadura Solar ──
            if (!passiveExecuting) {
                for (const _bpSN in gameState.characters) {
                    const _bpSC = gameState.characters[_bpSN];
                    if (!_bpSC || _bpSC.isDead || _bpSC.hp <= 0 || !_bpSC.passive) continue;
                    if (_bpSC.passive.name !== 'El Carcelero de los Malditos') continue;
                    passiveExecuting = true;
                    for (const _aln in gameState.characters) {
                        const _alc = gameState.characters[_aln];
                        if (!_alc || _alc.isDead || _alc.hp <= 0 || _alc.team !== _bpSC.team) continue;
                        _alc.maxHp = (_alc.maxHp||0) + 3;
                        addLog('☀️ El Carcelero de los Malditos: ' + _aln + ' HP máximo +3 (Quemadura Solar aplicada)', 'buff');
                    }
                    passiveExecuting = false;
                    break;
                }
            }
        }

        function applyFuria(targetName, duration) {
            const target = gameState.characters[targetName];
            if (!target) return;
            target.statusEffects.push({ name: 'Furia', type: 'buff', duration, emoji: '🔥', untilRoundEnd: false });
            addLog(`🔥 ${targetName} activa Furia por ${duration} turno${duration > 1 ? 's' : ''} (50% más de daño)`, 'buff');
        }

        function applyFrenesi(targetName, duration) {
            const target = gameState.characters[targetName];
            if (!target) return;
            target.statusEffects.push({ name: 'Frenesi', type: 'buff', duration, emoji: '⚡', untilRoundEnd: false });
            addLog(`⚡ ${targetName} activa Frenesí por ${duration} turno${duration > 1 ? 's' : ''} (50% chance crit)`, 'buff');
        }

        // Aplica buff Esquivar permanente (50% chance de esquivar cualquier ataque)
        function applyDodge(targetName) {
            const target = gameState.characters[targetName];
            if (!target) return;
            target.hasDodge = true;
            target.statusEffects.push({ name: 'Esquivar', type: 'buff', duration: 9999, emoji: '💨' });
            addLog(`💨 ${targetName} obtiene Buff Esquivar permanente (50% de esquivar ataques)`, 'buff');
        }

        // Contraataque buff: responde automáticamente con básico tras recibir un ataque
        function applyCounterattackBuff(targetName, duration) {
            const target = gameState.characters[targetName];
            if (!target) return;
            target.statusEffects.push({ name: 'Contraataque', type: 'buff', duration, emoji: '⚔️' });
            addLog(`⚔️ ${targetName} obtiene Buff Contraataque por ${duration} turno${duration > 1 ? 's' : ''}`, 'buff');
        }

        // Sigilo por N rondas (untilRoundEnd se decrementa manualmente en processEndOfRound)
        function applyAuraBuff(targetName, auraType) {
            // auraType: 'fuego'|'gelida'|'oscura'|'luz'
            const target = gameState.characters[targetName];
            if (!target) return;
            const auraMap = {
                'fuego':  { name: 'Aura de fuego',  emoji: '🔥', duration: 2 },
                'gelida': { name: 'Aura gelida',     emoji: '❄️', duration: 2 },
                'oscura': { name: 'Aura oscura',     emoji: '🌑', duration: 2 },
                'luz':    { name: 'Aura de Luz',     emoji: '✨', duration: 2 },
                'infectar': { name: 'Infectar',      emoji: '🦠', duration: 2 },
                'reflejar': { name: 'Reflejar',      emoji: '🪞', duration: 2 },
            };
            const aura = auraMap[auraType];
            if (!aura) return;
            // Remove old instance and apply new
            target.statusEffects = (target.statusEffects || []).filter(e => e && e.name !== aura.name);
            target.statusEffects.push({ name: aura.name, type: 'buff', duration: aura.duration, emoji: aura.emoji });
            addLog(aura.emoji + ' ' + targetName + ' recibe ' + aura.name + ' (' + aura.duration + ' turnos)', 'buff');
        }

        function applyStealth(targetName, rounds) {
            const target = gameState.characters[targetName];
            if (!target) return;
            // Limpiar sigilo previo
            target.statusEffects = target.statusEffects.filter(e => !(e && normAccent(e.name || '') === 'sigilo'));
            target.statusEffects.push({
                name: 'Sigilo', emoji: '👤', type: 'buff',
                duration: 999, untilRoundEnd: true, sigiloRoundsLeft: rounds
            });
            addLog(`👤 ${targetName} activa Sigilo por ${rounds} ronda${rounds > 1 ? 's' : ''}`, 'buff');
        }
