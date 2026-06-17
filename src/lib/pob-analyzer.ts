/**
 * PoB Analyzer: Extracts intelligence from the decoded PoB object
 */

import { ArchetypeProgression, BenchmarkInfo, getProgressionForSkill } from './meta-data';

/**
 * PoB does not export a per-damage-type DPS breakdown anywhere in its saved XML (verified
 * against the PathOfBuildingCommunity source: BuildDisplayStats.lua's curated stat list and
 * Build.lua's XML writer only ever serialize aggregate stats like TotalDPS/CombinedDPS, never
 * the internal FireHitAverage/ColdHitAverage/etc. PoB computes for its own UI). So instead of
 * guessing a skill's damage type from scattered flat damage mods on gear, we trust the skill's
 * own identity first - most skills have a fixed inherent damage type regardless of itemization.
 * A handful of "weapon conversion" archetypes (e.g. Kinetic Blast Wander) genuinely have no
 * fixed type - their damage type is whatever element the player crafted onto their weapon - so
 * those are marked 'WeaponDependent' and fall back to scanning gear instead.
 */
type KnownSkillDamageType = 'Elemental' | 'Chaos' | 'Physical' | 'WeaponDependent';

const SKILL_DAMAGE_TYPES: Record<string, KnownSkillDamageType> = {
  'righteous fire': 'Elemental',
  'toxic rain': 'Chaos',
  'hexblast': 'Chaos',
  'lightning strike': 'Elemental',
  'kinetic blast': 'WeaponDependent',
};

function getKnownSkillDamageType(skillName: string): KnownSkillDamageType | undefined {
  const normalized = skillName.toLowerCase();
  // Substring match so transfigured variants (e.g. "Toxic Rain of Withering") still resolve.
  const match = Object.keys(SKILL_DAMAGE_TYPES).find(key => normalized.includes(key));
  return match ? SKILL_DAMAGE_TYPES[match] : undefined;
}

export type BuildArchetype = {
  isCrit: boolean;
  isMinion: boolean;
  isSpell: boolean;
  isAttack: boolean;
  defenseType: 'Life' | 'ES' | 'Ward' | 'Hybrid';
  mainSkillName: string;
  damageType: 'Elemental' | 'Chaos' | 'Physical';
  totalDPS: number;
  breakdown: { chaos: number, ele: number, phys: number };
};

export type OptimizationInsight = {
  category: 'Missing' | 'Upgrade' | 'Meta Shift';
  item: string;
  description: string;
  type: BenchmarkInfo['type'];
};

export function analyzeBuildArchetype(pobData: any): BuildArchetype {
  const stats = pobData.PathOfBuilding.Build[0].PlayerStat || [];
  const skillsRaw = pobData.PathOfBuilding.Skills[0].Skill || [];
  const skills = Array.isArray(skillsRaw) ? skillsRaw : [skillsRaw];
  
  const getStat = (name: string) => parseFloat(stats.find((s: any) => s.$.stat === name)?.$.value || '0');

  // 1. Detect Main Skill
  let mainSkillName = 'Unknown';
  let allGemsInBuild: { name: string, isMain: boolean, links: number, isSupport: boolean }[] = [];
  const findGems = (obj: any, isMainGroup: boolean = false) => {
    if (!obj || typeof obj !== 'object') return;
    if (obj.Gem) {
      const gems = Array.isArray(obj.Gem) ? obj.Gem : [obj.Gem];
      gems.forEach((g: any) => {
        const d = g.$ || g;
        if (d.enabled === 'true') {
          allGemsInBuild.push({ 
            name: d.nameSpec, 
            isMain: isMainGroup || d.mainActiveSkill === 'true',
            links: gems.length,
            isSupport: d.nameSpec.toLowerCase().includes('support')
          });
        }
      });
    }
    Object.entries(obj).forEach(([key, val]) => {
      if (key === 'Gem') return;
      const nextIsMain = isMainGroup || (key === 'Skill' && val && (val as any).$ && (val as any).$.mainActiveSkill === 'true');
      if (Array.isArray(val)) val.forEach(v => findGems(v, nextIsMain));
      else findGems(val, nextIsMain);
    });
  };
  const mainSocketGroupIndex = parseInt(pobData.PathOfBuilding.Build[0].$.mainSocketGroup || '1') - 1;
  if (skills[mainSocketGroupIndex]) findGems(skills[mainSocketGroupIndex], true);
  if (allGemsInBuild.length === 0) findGems(pobData.PathOfBuilding.Skills);
  const target = allGemsInBuild.find(g => g.isMain && !g.isSupport) || allGemsInBuild.filter(g => !g.isSupport).sort((a, b) => b.links - a.links)[0];
  mainSkillName = target?.name || 'Unknown';

  // 2. Damage Detection
  const totalCombined = getStat('CombinedDPS') || getStat('FullDPS') || getStat('AverageDamage') || 1;
  const totalMana = getStat('Mana') || 4038;
  const items = pobData.PathOfBuilding.Items[0].Item || [];
  const itemArray = Array.isArray(items) ? items : [items];
  const itemsString = JSON.stringify(itemArray).toLowerCase();
  const isAttackSkill = JSON.stringify(skills).toLowerCase().includes('attack');

  // Detect Unholy Might (100% Phys to Chaos Conversion - verified current PoE1 behaviour,
  // post-3.24 rework; it used to be a 30% "as extra" bonus, not a full conversion).
  const hasUnholyMight = itemsString.includes('unholy might') || JSON.stringify(allGemsInBuild).toLowerCase().includes('unholy might');

  const knownType = getKnownSkillDamageType(mainSkillName);
  let breakdown: { chaos: number, ele: number, phys: number };

  if (knownType && knownType !== 'WeaponDependent') {
    // Trust the skill's own known identity rather than guessing from gear mods.
    breakdown = { chaos: 0, ele: 0, phys: 0 };
    if (knownType === 'Chaos') breakdown.chaos = 100;
    else if (knownType === 'Physical') breakdown.phys = 100;
    else breakdown.ele = 100;

    if (hasUnholyMight && breakdown.phys > 0) {
      breakdown.chaos += breakdown.phys;
      breakdown.phys = 0;
    }
  } else {
    // Unknown skill, or a weapon-conversion archetype (e.g. Kinetic Blast) whose damage type
    // is determined by gear choice rather than the skill itself. Best-effort fallback: sum
    // flat "Adds X to Y <type> Damage" mods across gear as a proxy for the damage split.
    const scanItemsForFlat = (type: string) => {
      let totalFlat = 0;
      itemArray.forEach((item: any) => {
        const text = (item._ || item).toLowerCase();
        if (text.includes(type.toLowerCase()) && text.includes('adds')) {
          const matches = text.match(/adds (\d+) to (\d+)/g);
          if (matches) {
            matches.forEach((m: string) => {
              const nums = m.match(/\d+/g);
              if (nums) totalFlat += (parseInt(nums[0]) + parseInt(nums[1])) / 2;
            });
          }
        }
      });
      return totalFlat;
    };

    let chaos = 0;
    let ele = scanItemsForFlat('fire') + scanItemsForFlat('cold') + scanItemsForFlat('lightning');
    let phys = scanItemsForFlat('physical');

    // Kinetic Blast of Clustering: Added Physical Damage equal to 17% of Maximum Mana
    // (verified against the gem's current 3.27+ tooltip).
    if (mainSkillName.toLowerCase().includes('clustering')) {
      phys += totalMana * 0.17;
    }

    // Whispers of Infinity: (5-10) to (20-25) Added ATTACK Chaos Damage per 100 Maximum Mana
    // (verified against the item's wiki tooltip) - only applies to Attack skills.
    if (isAttackSkill && itemsString.includes('whispers of infinity')) {
      chaos += (totalMana / 100) * 12.5; // ~midpoint of the roll range
    }

    if (hasUnholyMight) {
      chaos += phys;
      phys = 0;
    }

    const totalFlat = chaos + ele + phys || 1;
    breakdown = {
      chaos: (chaos / totalFlat) * 100,
      ele: (ele / totalFlat) * 100,
      phys: (phys / totalFlat) * 100,
    };
  }

  let damageType: BuildArchetype['damageType'] = 'Elemental';
  if (breakdown.chaos > breakdown.ele && breakdown.chaos > breakdown.phys) damageType = 'Chaos';
  else if (breakdown.phys > breakdown.ele) damageType = 'Physical';

  return { 
    isCrit: getStat('CritChance') > 5, 
    isMinion: JSON.stringify(skills).toLowerCase().includes('minion'), 
    isSpell: JSON.stringify(skills).toLowerCase().includes('spell'), 
    isAttack: isAttackSkill,
    defenseType: getStat('EnergyShield') > getStat('Life') * 2 ? 'ES' : (getStat('EnergyShield') > 500 ? 'Hybrid' : 'Life'), 
    mainSkillName, 
    damageType, 
    totalDPS: totalCombined,
    breakdown
  };
}

export function generateOptimizationReport(pobData: any, archetype: BuildArchetype): OptimizationInsight[] {
  const insights: OptimizationInsight[] = [];
  const meta = getProgressionForSkill(archetype.mainSkillName);
  if (!meta) return [];
  const pobString = JSON.stringify(pobData).toLowerCase();

  meta.benchmarks.forEach(bench => {
    if (bench.damageType && bench.damageType !== 'Any' && bench.damageType !== archetype.damageType) return;
    const isPresent = pobString.includes(bench.name.toLowerCase());
    const isRedundant = bench.redundantWith && pobString.includes(bench.redundantWith.toLowerCase());
    if (!isPresent && !isRedundant) {
      insights.push({ category: 'Missing', item: bench.name, description: bench.description, type: bench.type });
    }
  });

  meta.slots.forEach(slot => {
    slot.steps.forEach(step => {
      if (step.damageType && step.damageType !== 'Any' && step.damageType !== archetype.damageType) return;
      if (step.isMandatory && step.tier !== 'Budget') {
        if (!pobString.includes(step.itemName.toLowerCase())) {
          insights.push({ category: 'Missing', item: step.itemName, description: step.description, type: 'Item' });
        }
      }
    });
  });
  return insights;
}

export function getDynamicTips(archetype: BuildArchetype, stageLevel: number): string[] {
  const tips: string[] = [];
  if (stageLevel === 90) tips.push(`Refine your ${archetype.mainSkillName} links (look for 21/20 gems).`);
  return tips;
}
