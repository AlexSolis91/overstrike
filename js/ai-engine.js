// ==================== IA ENGINE ====================
        function executeAITurn(charName) {
            try {
                const char = gameState.characters[charName];
                if (!char || char.isDead || char.hp <= 0) { endTurn(); return; }

                if (char.statusEffects) {
                    const stunned = char.statusEffects.some(e => e && (normAccent(e.name||'') === 'aturdimiento' || normAccent(e.name||'') === 'mega aturdimiento'));
                    if (stunned) { addLog('⭐ ' + (gameState.gameMode !== 'ranked' ? '[IA] ' : '') + charName + ' está aturdido y pierde su turno', 'damage'); endTurn(); return; }
                    if (hasStatusEffect(charName, 'Mega Congelacion')) { addLog('🧊 [IA] ' + charName + ' está Mega Congelado y pierde su turno', 'damage'); endTurn(); return; }
                    if (hasStatusEffect(charName, 'Congelacion') && Math.random() < 0.5) { addLog('❄️ [IA] ' + charName + ' está Congelado y pierde su turno', 'damage'); endTurn(); return; }
                    if (hasStatusEffect(charName, 'Miedo') && Math.random() < 0.5) { addLog('😱 [IA] ' + charName + ' está paralizado por el Miedo', 'damage'); endTurn(); return; }
                }

                const myTeam = char.team;
                const enemyTeam = myTeam === 'team1' ? 'team2' : 'team1';

                // ── Helpers ──────────────────────────────────────────────────
                function getAliveAllies() {
                    return Object.keys(gameState.characters).filter(n => {
                        const c = gameState.characters[n];
                        return c && c.team === myTeam && !c.isDead && c.hp > 0;
                    });
                }
                function getAliveEnemies() {
                    return Object.keys(gameState.characters).filter(n => {
                        const c = gameState.characters[n];
                        return c && c.team === enemyTeam && !c.isDead && c.hp > 0 &&
                            !(c.statusEffects && c.statusEffects.some(e => e && normAccent(e.name||'') === 'sigilo'));
                    });
                }
                function getUsableAbilities() {
                    const SINGLE_SUMMON_MAP_AI = {
                        'summon_sphinx':       'Abu el-Hol Sphinx',
                        'summon_ramesseum':    'Ramesseum Tentyris',
                        'summon_douma_hielo':  'Douma de Hielo',
                        'summon_gigante_hielo':'Gigante de Hielo',
                        'summon_señuelo':      'Señuelo',
                        'summon_ghost':        'Ghost',
                    };
                    return char.abilities.filter(function(ab) {
                        if (ab.used || char.charges < ab.cost) return false;
                        // Bloquear si la invocación única ya está activa
                        const _sName = SINGLE_SUMMON_MAP_AI[ab.effect];
                        if (_sName) {
                            const alreadyActive = Object.values(gameState.summons).some(function(s) {
                                return s && s.name === _sName && s.hp > 0 && s.summoner === charName;
                            });
                            if (alreadyActive) return false;
                        }
                        return true;
                    });
                }
                function hpPct(n) {
                    const c = gameState.characters[n]; return c ? c.hp / c.maxHp : 1;
                }
                function hasBuff(n, bName) { return hasStatusEffect(n, bName); }
                function summonPresent(sName, team) {
                    return Object.values(gameState.summons).some(s => s && s.name === sName && s.team === team);
                }
                function getCharges(n) {
                    const c = gameState.characters[n]; return c ? (c.charges || 0) : 0;
                }
                function getMaxDamage(n) {
                    const c = gameState.characters[n];
                    if (!c || !c.abilities) return 0;
                    return c.abilities.reduce((mx, ab) => Math.max(mx, ab.damage || 0), 0);
                }
                function allyTeamSummonCount() {
                    return Object.values(gameState.summons).filter(s => s && s.team === myTeam && s.hp > 0).length;
                }
                function enemyTeamSummonCount() {
                    return Object.values(gameState.summons).filter(s => s && s.team === enemyTeam && s.hp > 0).length;
                }

                const allies = getAliveAllies();
                const enemies = getAliveEnemies();
                const usable = getUsableAbilities();

                if (enemies.length === 0 || usable.length === 0) { endTurn(); return; }

                // ═══════════════════════════════════════════════════════════════════
                // IMPROVEMENT 1: CHARGE MANAGEMENT
                // Predict charges needed for next Over/Special and decide if we should
                // farm charges with basics instead of spending them prematurely.
                // ═══════════════════════════════════════════════════════════════════
                function chargesNeededForBestAbility() {
                    const nonBasic = char.abilities.filter(ab => !ab.used && ab.type !== 'basic');
                    if (nonBasic.length === 0) return 0;
                    const cheapest = nonBasic.reduce((a, b) => a.cost < b.cost ? a : b);
                    return Math.max(0, cheapest.cost - char.charges);
                }
                const chargesShortfall = chargesNeededForBestAbility();
                // If we're only 1-2 charges away from a big ability, prefer basics
                const shouldFarmCharges = chargesShortfall > 0 && chargesShortfall <= 2;

                // ═══════════════════════════════════════════════════════════════════
                // IMPROVEMENT 2: LOOKAHEAD — simulate state after each ability
                // Score bonus if using the ability can kill an enemy (kill-check),
                // penalize if it wastes an Over on a near-dead enemy
                // ═══════════════════════════════════════════════════════════════════
                function lookaheadScore(ab, tgt) {
                    let bonus = 0;
                    if (!tgt || ab.target === 'self') return 0;
                    const tgtChar = gameState.characters[tgt];
                    if (!tgtChar) return 0;

                    // Can this kill the target?
                    const effectiveDmg = ab.damage * (char.rikudoMode ? 2 : 1);
                    if (effectiveDmg >= tgtChar.hp && tgtChar.hp > 0) {
                        // Big bonus for kill shots
                        bonus += 150;
                        // Extra bonus if target was dangerous (high charges)
                        if (tgtChar.charges >= 8) bonus += 50;
                        // Extra bonus if it's the last enemy
                        if (enemies.length === 1) bonus += 80;
                    }

                    // Penalize: using an Over on a target that could be killed by a Basic
                    if (ab.type === 'over') {
                        const basicCanKill = char.abilities.some(b => b.type === 'basic' && b.damage >= tgtChar.hp);
                        if (basicCanKill) bonus -= 200;
                    }

                    // Penalize: using AOE when there's only 1 enemy (waste)
                    if (ab.target === 'aoe' && enemies.length === 1 && ab.type === 'over') bonus -= 40;

                    return bonus;
                }

                // ═══════════════════════════════════════════════════════════════════
                // IMPROVEMENT 3: THREAT ASSESSMENT
                // Identify the most dangerous enemy (can kill an ally next turn or
                // has high charges) and prioritize eliminating them.
                // ═══════════════════════════════════════════════════════════════════
                function getThreatScore(n) {
                    const c = gameState.characters[n];
                    if (!c) return 0;
                    let threat = 0;
                    // High charges = can use Over soon
                    threat += (c.charges || 0) * 8;
                    // High damage potential
                    threat += getMaxDamage(n) * 15;
                    // Low HP ally next to this enemy = kill threat
                    const fragileAlly = allies.some(a => hpPct(a) < 0.4);
                    if (fragileAlly && getMaxDamage(n) >= 5) threat += 60;
                    // Support characters are secondary targets but still threats
                    return threat;
                }
                function getMostThreateningEnemy() {
                    if (enemies.length === 0) return null;
                    return enemies.reduce((a, b) => getThreatScore(a) >= getThreatScore(b) ? a : b);
                }
                const mostThreatening = getMostThreateningEnemy();

                // ═══════════════════════════════════════════════════════════════════
                // IMPROVEMENT 4: COMPOSITION COUNTER
                // Detect enemy buffs/passives and choose abilities that counter them.
                // ═══════════════════════════════════════════════════════════════════
                function hasProtectedEnemy() {
                    return enemies.some(n => {
                        const c = gameState.characters[n];
                        return c && (hasStatusEffect(n, 'Escudo Sagrado') || hasStatusEffect(n, 'Proteccion Sagrada') || (c.shield || 0) > 3);
                    });
                }
                function hasAuraEnemy(auraName) {
                    return enemies.some(n => hasStatusEffect(n, auraName));
                }

                // ═══════════════════════════════════════════════════════════════════
                // IMPROVEMENT 5: DEBUFF MEMORY
                // Before using a high-cost Over, check if target has Escudo Sagrado
                // or Proteccion Sagrada — if so, prefer a dispel first.
                // ═══════════════════════════════════════════════════════════════════
                function targetIsProtected(n) {
                    return hasStatusEffect(n, 'Escudo Sagrado') || hasStatusEffect(n, 'Proteccion Sagrada');
                }
                const DISPEL_EFFECTS = ['cleanse_enemy_debuff', 'enuma_elish', 'another_dimension'];
                function shouldDispelFirst(ab) {
                    if (!DISPEL_EFFECTS.includes(ab.effect)) return false;
                    return enemies.some(n => targetIsProtected(n));
                }

                // ═══════════════════════════════════════════════════════════════════
                // IMPROVEMENT 6: REACTIVE HEALS — only use heals when needed
                // ═══════════════════════════════════════════════════════════════════
                function allyNeedsHealUrgently() {
                    return allies.some(n => hpPct(n) < 0.35);
                }
                function allyNeedsHeal() {
                    return allies.some(n => hpPct(n) < 0.60);
                }

                // ═══════════════════════════════════════════════════════════════════
                // IMPROVEMENT 7: TURN ORDER AWARENESS
                // If this char has highest speed and will get another turn soon,
                // save Overs for the following turn if no kill shot available.
                // ═══════════════════════════════════════════════════════════════════
                function willActSoonAgain() {
                    const mySpeed = char.speed || 0;
                    const fastestEnemy = enemies.reduce((mx, n) => Math.max(mx, (gameState.characters[n] ? gameState.characters[n].speed || 0 : 0)), 0);
                    return mySpeed > fastestEnemy + 10; // significantly faster
                }

                // ═══════════════════════════════════════════════════════════════════
                // SUPPORT character detection (unchanged from before)
                // ═══════════════════════════════════════════════════════════════════
                const SUPPORT_EFFECTS = ['heal', 'don_de_la_vida', 'regen', 'shield', 'summon',
                    'el_rey_caido', 'summon_sphinx', 'summon_ramesseum', 'summon_dragon',
                    'arise_summon', 'enkidu', 'dispel_target_padme_charges', 'summon_señuelo'];
                function isSupportChar(name) {
                    const c = gameState.characters[name];
                    if (!c || !c.abilities) return false;
                    return c.abilities.some(function(ab) {
                        return SUPPORT_EFFECTS.some(function(eff) { return (ab.effect||'').includes(eff); })
                            || ab.target === 'ally_single';
                    });
                }
                function abilityTier(ab) {
                    if (ab.type === 'over') return 3;
                    if (ab.type === 'special') return 2;
                    return 1;
                }

                // ─────────────────────────────────────────────────────────────────
                // MAIN SCORING FUNCTION — incorporates all 7 improvements
                // ─────────────────────────────────────────────────────────────────
                function scoreAbility(ab) {
                    let score = 0;

                    // ── TIER BONUS ──────────────────────────────────────────────
                    score += abilityTier(ab) * 120;

                    // ── IMPROVEMENT 1: CHARGE FARMING ──────────────────────────
                    // If only 1-2 charges away from a big ability, strongly prefer basics
                    if (shouldFarmCharges && ab.type === 'basic') score += 180;
                    if (shouldFarmCharges && ab.type !== 'basic') score -= 60;

                    // ── IMPROVEMENT 2: LOOKAHEAD (applied during target selection) ──
                    // We pre-compute best target for damage abilities here
                    let lookaheadTarget = null;
                    if (ab.damage > 0 && ab.target === 'single') {
                        // Try each enemy and find best lookahead
                        const killable = enemies.find(n => {
                            const c = gameState.characters[n];
                            const eff = ab.damage * (char.rikudoMode ? 2 : 1);
                            return c && c.hp > 0 && eff >= c.hp;
                        });
                        if (killable) {
                            lookaheadTarget = killable;
                            score += lookaheadScore(ab, killable);
                        }
                    }

                    // ── IMPROVEMENT 3: THREAT TARGETING ────────────────────────
                    // Bonus for abilities that can damage the most threatening enemy
                    if (ab.damage > 0 && mostThreatening) {
                        const tgtChar = gameState.characters[mostThreatening];
                        const effectiveDmg = ab.damage * (char.rikudoMode ? 2 : 1);
                        if (tgtChar && effectiveDmg > 0) {
                            score += Math.min(60, getThreatScore(mostThreatening) / 3);
                        }
                    }

                    // ── IMPROVEMENT 4: COMPOSITION COUNTER ─────────────────────
                    // AOE is better when enemy has Aura de fuego (avoid direct hits)
                    if (ab.target === 'aoe' && hasAuraEnemy('Aura de fuego')) score += 40;
                    // Enuma Elish (shield strip) is prioritized when enemies have shields
                    if (ab.effect === 'enuma_elish' && hasProtectedEnemy()) score += 80;
                    if (DISPEL_EFFECTS.includes(ab.effect) && enemies.some(n => targetIsProtected(n))) score += 90;

                    // ── IMPROVEMENT 5: DEBUFF MEMORY ───────────────────────────
                    // Penalize Overs on fully-protected targets
                    if (ab.type === 'over' && ab.damage > 0) {
                        const mainTarget = enemies.find(n => targetIsProtected(n));
                        if (mainTarget && enemies.length === 1) score -= 100; // only target is protected
                    }

                    // ── IMPROVEMENT 6: REACTIVE HEALS ──────────────────────────
                    const CLEANSE_EFFECTS = ['heal_cleanse', 'aoe_cleanse_allies', 'dispel_heal_allies',
                        'grito_de_esparta', 'dispel_target_padme_charges'];
                    const _allyDebuffCount = allies.reduce(function(sum, n) {
                        const c = gameState.characters[n];
                        return sum + (c && c.statusEffects ? c.statusEffects.filter(e => e && e.type === 'debuff').length : 0);
                    }, 0);
                    if (CLEANSE_EFFECTS.includes(ab.effect) || (ab.effect && ab.effect.includes('cleanse'))) {
                        score += _allyDebuffCount >= 3 ? 200 : _allyDebuffCount >= 1 ? 120 : 10;
                    }
                    if (ab.target === 'ally_single' || ab.target === 'self') {
                        const lowestAlly = allies.reduce((a,b) => hpPct(a) < hpPct(b) ? a : b);
                        const lowestPct = hpPct(lowestAlly);
                        if (ab.effect && (ab.effect.includes('heal') || ab.effect === 'don_de_la_vida')) {
                            // REACTIVE: only prioritize heal when ally actually needs it
                            if (allyNeedsHealUrgently()) score += 250;      // critical — heal NOW
                            else if (allyNeedsHeal())    score += 80;        // helpful
                            else                          score += 5;         // not needed, low prio
                        }
                        if (ab.shieldAmount) score += lowestPct < 0.4 ? 65 : 30;
                        // ALEXSTRASZA: priorizar Fuego Vital / Llama Preservadora si aliado no tiene Aura de fuego
                        if (ab.effect === 'fuego_vital' || ab.effect === 'llama_preservadora') {
                            const _axAlliesNoAura = allies.filter(function(n) { return !hasStatusEffect(n, 'Aura de fuego'); });
                            if (_axAlliesNoAura.length > 0) score += allyNeedsHeal() ? 200 : 120;
                            else score -= 50; // todos ya tienen aura, baja prioridad
                        }
                        if (ab.effect && (ab.effect.includes('regen') || ab.effect === 'leyenda_nordica')) {
                            score += allyNeedsHeal() ? 60 : 20;
                        }
                        if (ab.effect === 'grito_de_esparta') {
                            const anyDebuffed = allies.some(n => gameState.characters[n].statusEffects.some(e => e && e.type === 'debuff'));
                            score += anyDebuffed ? 85 : 25;
                        }
                        if (ab.effect === 'ultra_instinto') score += char.ultraInstinto ? -999 : 70;
                        if (ab.effect === 'poder_del_anillo') score += char.sauronTransformed ? -999 : 65;
                        if (ab.effect === 'muzan_transform') score += char.muzanTransformed ? -999 : 60;
                        if (ab.effect === 'kaio_ken') score += 55;
                    }

                    // ── IMPROVEMENT 7: TURN ORDER AWARENESS ────────────────────
                    // If we're significantly faster and will act again soon, save Overs
                    // unless we have a kill shot available
                    if (ab.type === 'over' && willActSoonAgain()) {
                        const hasKillShot = enemies.some(n => {
                            const c = gameState.characters[n];
                            return c && c.hp > 0 && ab.damage >= c.hp;
                        });
                        if (!hasKillShot) score -= 80; // save Over for better moment
                    }

                    // ── STANDARD DAMAGE SCORING ─────────────────────────────────
                    if (ab.damage > 0) {
                        score += ab.damage * 5;
                        if (ab.target === 'aoe' && enemies.length >= 2) score += 25 * enemies.length;
                        if (ab.effect === 'blood_eagle') {
                            const weakEnemy = enemies.find(n => hpPct(n) <= 0.5);
                            if (weakEnemy) score += 70;
                        }
                        if (ab.effect && (ab.effect.includes('poison') || ab.effect.includes('burn') ||
                            ab.effect.includes('bleed') || ab.effect.includes('freeze') ||
                            ab.effect.includes('stun') || ab.effect.includes('fear'))) score += 25;
                        if (ab.effect === 'enuma_elish') {
                            const shielded = enemies.filter(n => (gameState.characters[n].shield||0) > 0);
                            score += shielded.length > 0 ? 45 : 0;
                        }
                        if (ab.effect === 'golpe_grave') score += enemies.some(n => hpPct(n) <= 0.6) ? 55 : 20;
                    }

                    // ── STANDARD DEBUFF SCORING ──────────────────────────────────
                    if (ab.damage === 0 && (ab.target === 'single' || ab.target === 'aoe')) {
                        if (ab.effect === 'apply_mega_stun') score += 75;
                        if (ab.effect === 'apply_possession_1' || ab.effect === 'apply_possession') score += 60;
                        if (ab.effect === 'apply_confusion') score += 50;
                        if (ab.effect === 'apply_fear_1') score += 45;
                        if (ab.effect === 'apply_counterattack') score += 40;
                        if (ab.effect === 'apply_megaprovocation_buff') score += 55;
                        if (ab.effect === 'purgatorio_v2') score += 80;
                    }

                    // ── REVIVE — highest priority when a dead ally exists ──────────
                    if (ab.effect === 'revive_ally') {
                        const _deadAllies = allies.length < 5
                            ? Object.keys(gameState.characters).filter(function(n) {
                                const c = gameState.characters[n];
                                return c && c.team === myTeam && c.isDead;
                              })
                            : [];
                        if (_deadAllies.length > 0) {
                            score += 500; // Always revive if possible
                        } else {
                            score -= 999; // No dead allies — useless
                        }
                    }

                    // ── AMATERASU (Itachi): máxima prioridad si hay invocaciones enemigas ──
                    if (ab.effect === 'amaterasu_itachi') {
                        const _enemySummonCount = Object.values(gameState.summons).filter(function(s) {
                            return s && s.team === enemyTeam && s.hp > 0;
                        }).length;
                        score += _enemySummonCount > 0 ? 400 : 0; // Prioridad altísima si hay invocaciones
                    }

                    // ── SUMMONS ──────────────────────────────────────────────────
                    if (ab.effect === 'el_rey_caido') score += summonPresent('Sindragosa', myTeam) ? 20 : 75;
                    if (ab.effect === 'summon_sphinx') score += summonPresent('Sphinx Wehem-Mesut', myTeam) ? -200 : 60;
                    if (ab.effect === 'summon_ramesseum') score += summonPresent('Ramesseum Tentyris', myTeam) ? -200 : 55;
                    if (ab.effect === 'arise_summon') {
                        const teamSummonCount = allyTeamSummonCount();
                        score += teamSummonCount < 4 ? 65 : 10;
                    }
                    if (ab.effect === 'enkidu' || ab.effect === 'enkidu_cadenas') {
                        const hasSummons = enemyTeamSummonCount() > 0;
                        score += hasSummons ? 90 : 10;
                    }
                    if (ab.effect === 'cadenas_hielo') score += enemies.some(n => getCharges(n) >= 5) ? 65 : 25;

                    // ── FINAL GUARDS ─────────────────────────────────────────────
                    if (ab.type !== 'basic' && char.charges < ab.cost) score -= 999;
                    if (char.charges < 3 && ab.type !== 'basic') score -= (ab.cost - char.charges) * 10;

                    return score;
                }

                // ─────────────────────────────────────────────────────────────────
                // Pick best ability
                // ─────────────────────────────────────────────────────────────────
                usable.sort((a,b) => scoreAbility(b) - scoreAbility(a));
                let chosen = usable[0];

                // ═══════════════════════════════════════════════════════════════════
                // PERSONAJES ESPECIALES — lógica personalizada de IA
                // ═══════════════════════════════════════════════════════════════════

                // ── PADME AMIDALA: priorizar Over > Especial2 > Especial1 > Básico ──
                if (charName === 'Padme Amidala' || charName === 'Padme Amidala v2') {
                    const _padmeOver = usable.find(ab => ab.type === 'over');
                    const _padmeSp2  = usable.filter(ab => ab.type === 'special')[1];
                    const _padmeSp1  = usable.filter(ab => ab.type === 'special')[0];
                    const _padmeBasic= usable.find(ab => ab.type === 'basic');
                    chosen = _padmeOver || _padmeSp2 || _padmeSp1 || _padmeBasic || chosen;
                }

                // ── MADARA UCHIHA: priorizar Over si disponible; si no Rikudo no está activo priorizar Modo Rikudō;
                //    si Rikudo activo → Susanoo AOE > Mangekyō > Básico ──
                if (charName === 'Madara Uchiha' || charName === 'Madara Uchiha v2') {
                    const _mChar = gameState.characters[charName];
                    const _mOver  = usable.find(ab => ab.type === 'over');
                    const _mSp    = usable.filter(ab => ab.type === 'special');
                    const _mBasic = usable.find(ab => ab.type === 'basic');
                    if (_mChar && _mChar.rikudoMode) {
                        // En Rikudō: Susanoo (AOE) > Mangekyō > Básico
                        const _susanoo = _mSp.find(ab => ab.effect === 'susanoo' || ab.target === 'aoe');
                        const _mangekyou = _mSp.find(ab => ab.effect === 'sharingan_aoe');
                        chosen = _susanoo || _mangekyou || _mBasic || chosen;
                    } else {
                        // Sin Rikudō: Over (transformación) si disponible
                        chosen = _mOver || _mSp[1] || _mSp[0] || _mBasic || chosen;
                    }
                }

                // ── SAITAMA: básico siempre salvo que pueda matar con especial,
                //    o tenga 20 cargas → Over sobre el enemigo más peligroso ──
                if (charName === 'Saitama' || charName === 'Saitama v2') {
                    const _sOver  = usable.find(ab => ab.type === 'over');
                    const _sSp    = usable.filter(ab => ab.type === 'special');
                    const _sBasic = usable.find(ab => ab.type === 'basic');
                    const _sChar  = gameState.characters[charName];
                    // Over si tiene 20 cargas
                    if (_sOver && _sChar && _sChar.charges >= 20) {
                        chosen = _sOver;
                    } else {
                        // Puede matar con especial?
                        const _killWithSp = _sSp.find(ab => {
                            return enemies.some(n => {
                                const c = gameState.characters[n];
                                return c && c.hp > 0 && ab.damage >= c.hp;
                            });
                        });
                        chosen = _killWithSp || _sBasic || chosen;
                    }
                }

                // ── REY DE LA NOCHE: priorizar Tormenta Invernal (AOE+congelación) y Toque de la Muerte ──
                if (charName === 'Rey de la Noche' || charName === 'Rey de la Noche v2') {
                    const _rdnOver  = usable.find(ab => ab.type === 'over');
                    const _rdnSp    = usable.filter(ab => ab.type === 'special');
                    const _rdnBasic = usable.find(ab => ab.type === 'basic');
                    const _rdnSp2   = _rdnSp.find(ab => ab.effect === 'toque_muerte_rdn');
                    const _rdnSp1   = _rdnSp.find(ab => ab.effect === 'tormenta_invernal_rdn');
                    chosen = _rdnOver || _rdnSp2 || _rdnSp1 || _rdnBasic || chosen;
                }

                // ── ALEXSTRASZA: curar al aliado más herido con básico/especial; Over cuando hay
                //    enemigos con quemaduras o aliados debilitados ──
                if (charName === 'Alexstrasza' || charName === 'Alexstrasza v2') {
                    const _axOver  = usable.find(ab => ab.type === 'over');
                    const _axSp    = usable.filter(ab => ab.type === 'special');
                    const _axBasic = usable.find(ab => ab.type === 'basic');
                    const _axLowestAlly = allies.reduce((a, b) => hpPct(a) < hpPct(b) ? a : b, allies[0]);
                    const _axLowestPct  = _axLowestAlly ? hpPct(_axLowestAlly) : 1;
                    const _axAllyNeedsShield = _axLowestPct < 0.70;
                    // Over: priorizar si cualquier aliado está por debajo de 50% HP
                    if (_axOver && _axLowestPct < 0.50) {
                        chosen = _axOver;
                    // Especial Llama Preservadora si aliado necesita escudo+aura
                    } else if (_axSp.length > 0 && _axAllyNeedsShield) {
                        // Llama Preservadora (mayor escudo) antes que Fuego Vital
                        const _axLlama = _axSp.find(ab => ab.effect === 'llama_preservadora');
                        const _axFuego = _axSp.find(ab => ab.effect === 'fuego_vital');
                        chosen = _axLlama || _axFuego || _axBasic || chosen;
                    } else {
                        chosen = _axBasic || chosen;
                    }
                }

                // ─────────────────────────────────────────────────────────────────
                // PICK TARGET — uses all improvements
                // ─────────────────────────────────────────────────────────────────
                function pickTarget(ab) {
                    if (ab.target === 'self' || ab.target === 'aoe') return charName;

                    if (ab.target === 'ally_single' || ab.target === 'ally_dead') {
                        // REVIVE: pick a dead ally
                        if (ab.effect === 'revive_ally' || ab.target === 'ally_dead') {
                            const _dead = Object.keys(gameState.characters).find(function(n) {
                                const c = gameState.characters[n];
                                return c && c.team === myTeam && c.isDead;
                            });
                            if (_dead) return _dead;
                        }
                        // ALEXSTRASZA — Fuego Vital / Llama Preservadora: preferir aliado sin Aura de fuego y con menos HP
                        if (ab.effect === 'fuego_vital' || ab.effect === 'llama_preservadora') {
                            const _noAura = allies.filter(function(n) { return !hasStatusEffect(n, 'Aura de fuego'); });
                            const _pool = _noAura.length > 0 ? _noAura : allies;
                            return _pool.reduce((a, b) => hpPct(a) < hpPct(b) ? a : b);
                        }
                        // IMPROVEMENT 6: pick ally that needs heal most (lowest HP)
                        if (ab.effect && (ab.effect.includes('heal') || ab.effect === 'don_de_la_vida')) {
                            return allies.reduce((a,b) => hpPct(a) < hpPct(b) ? a : b);
                        }
                        // For cleanse: pick ally with most debuffs
                        if (CLEANSE_EFFECTS.includes(ab.effect)) {
                            return allies.reduce((a,b) => {
                                const da = (gameState.characters[a].statusEffects||[]).filter(e=>e&&e.type==='debuff').length;
                                const db = (gameState.characters[b].statusEffects||[]).filter(e=>e&&e.type==='debuff').length;
                                return da >= db ? a : b;
                            });
                        }
                        // Default: lowest HP ally
                        return allies.reduce((a,b) => hpPct(a) < hpPct(b) ? a : b);
                    }

                    if (ab.target === 'single') {
                        // Taunt/MegaProv rules — always respected
                        const sauronBypass = sauronIgnoresRestrictions();
                        let aiTauntTarget = null;
                        for (const _n of ['Aldebaran', 'Thestalos']) {
                            const _c = gameState.characters[_n] || gameState.characters[_n + ' v2'];
                            const _name = gameState.characters[_n] ? _n : (_c ? _n + ' v2' : null);
                            if (_name && gameState.characters[_name] && gameState.characters[_name].team === enemyTeam &&
                                !gameState.characters[_name].isDead && gameState.characters[_name].hp > 0) {
                                aiTauntTarget = _name; break;
                            }
                        }
                        if (!aiTauntTarget) {
                            for (let _n in gameState.characters) {
                                const _c = gameState.characters[_n];
                                if (!_c || _c.team !== enemyTeam || _c.isDead || _c.hp <= 0) continue;
                                if (_c.statusEffects && _c.statusEffects.some(e => e && normAccent(e.name||'') === 'provocacion')) { aiTauntTarget = _n; break; }
                            }
                        }
                        const kamishData = checkKamishMegaProvocation(enemyTeam);
                        if (kamishData && !kamishData.isCharacter && !sauronBypass) return null;
                        if (kamishData && kamishData.isCharacter && !sauronBypass) aiTauntTarget = kamishData.characterName;
                        if (aiTauntTarget && !sauronBypass) return aiTauntTarget;

                        // ── IMPROVEMENT 2: Kill shot first ──────────────────────
                        const effectiveDmg = ab.damage * (char.rikudoMode ? 2 : 1);
                        const killShot = enemies.find(n => {
                            const c = gameState.characters[n];
                            return c && c.hp > 0 && effectiveDmg >= c.hp;
                        });
                        if (killShot) return killShot;

                        // ── IMPROVEMENT 5: Avoid protected targets if dispel available ──
                        if (ab.type === 'over' && hasProtectedEnemy()) {
                            const unprotected = enemies.find(n => !targetIsProtected(n));
                            if (unprotected) return unprotected;
                        }

                        // ── IMPROVEMENT 4: Counter Aura de fuego — prefer AOE over ST ──
                        // (handled in scoring, but for ST fallback pick non-Aura target)
                        if (hasAuraEnemy('Aura de fuego') && ab.target === 'single') {
                            const noAura = enemies.find(n => !hasStatusEffect(n, 'Aura de fuego'));
                            if (noAura) return noAura;
                        }

                        // ── IMPROVEMENT 3: Support/healer enemies first ──────────
                        const supportEnemy = enemies.find(n => isSupportChar(n));
                        if (supportEnemy) return supportEnemy;

                        // ── IMPROVEMENT 3: Threatening enemies ──────────────────
                        if (mostThreatening && getThreatScore(mostThreatening) > 60) return mostThreatening;

                        // ── Fallback: Most vulnerable ────────────────────────────
                        const mostVulnerable = enemies.reduce((a,b) => hpPct(a) < hpPct(b) ? a : b);
                        if (hpPct(mostVulnerable) < 0.6) return mostVulnerable;

                        // ── Stun/chain: highest charges ─────────────────────────
                        if (ab.effect === 'apply_mega_stun' || ab.effect === 'cadenas_hielo' || ab.effect === 'enkidu_cadenas') {
                            return enemies.reduce((a,b) => getCharges(a) >= getCharges(b) ? a : b);
                        }

                        // ── Default: highest threat ──────────────────────────────
                        return enemies.reduce((a,b) => getThreatScore(a) >= getThreatScore(b) ? a : b);
                    }
                    return enemies[Math.floor(Math.random() * enemies.length)];
                }

                const target = pickTarget(chosen);

                // ── SAITAMA Over: si tiene 20 cargas, apuntar al enemigo más peligroso ──
                let _saitamaOverride = null;
                if ((charName === 'Saitama' || charName === 'Saitama v2') &&
                    chosen.type === 'over' && enemies.length > 0) {
                    // Peligroso = mayor HP + mayor cantidad de cargas
                    _saitamaOverride = enemies.reduce(function(best, n) {
                        const cb = gameState.characters[best];
                        const cn = gameState.characters[n];
                        if (!cn) return best;
                        const scoreB = (cb ? cb.hp : 0) + (cb ? cb.charges : 0) * 2;
                        const scoreN = (cn.hp || 0) + (cn.charges || 0) * 2;
                        return scoreN > scoreB ? n : best;
                    }, enemies[0]);
                }

                // AMATERASU override: if there's an enemy summon, target it instead
                let _finalTarget = _saitamaOverride || target;
                let _amaterasuSummonId = null;
                if (chosen.effect === 'amaterasu_itachi') {
                    const _amSummonEntry = Object.entries(gameState.summons).find(function(e) {
                        return e[1] && e[1].team === enemyTeam && e[1].hp > 0;
                    });
                    if (_amSummonEntry) {
                        _amaterasuSummonId = _amSummonEntry[0];
                        _finalTarget = _amSummonEntry[1].name;
                    }
                }

                addLog((gameState.gameMode !== 'ranked' ? '🤖 IA (' + charName + ')' : '⚔️ ' + charName) + ' decide usar ' + chosen.name + (_finalTarget && _finalTarget !== charName ? ' sobre ' + _finalTarget : ''), 'info');

                gameState.selectedAbility = chosen;
                gameState.adjustedCost = chosen.cost;

                setTimeout(function() {
                    if (chosen.target === 'aoe' || chosen.target === 'self') {
                        executeAbility(charName);
                    } else if (_amaterasuSummonId) {
                        // Amaterasu targeting a summon
                        executeAbilitySummon(_amaterasuSummonId);
                    } else if (_finalTarget) {
                        executeAbility(_finalTarget);
                    } else {
                        endTurn();
                    }
                }, chosen.type === 'over' ? 200 : 400);

            } catch(err) {
                console.error('Error en executeAITurn:', err);
                endTurn();
            }
        }
        // ==================== FIN IA ENGINE ====================
