#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as path from 'path';

// Read the input file
const inputPath = '/home/jacobi/Code/zukan/src/core/data/moves.ts';
const content = fs.readFileSync(inputPath, 'utf8');

// Function to find matching closing brace
function findMatchingBrace(str: string, startIndex: number): number {
  let depth = 1;
  let i = startIndex;
  while (i < str.length && depth > 0) {
    if (str[i] === '{') depth++;
    if (str[i] === '}') depth--;
    i++;
  }
  return i - 1;
}

// Extract the Moves object content
const movesStart = content.indexOf('export const Moves:') + content.indexOf('{', content.indexOf('export const Moves:'));
const movesEnd = findMatchingBrace(content, movesStart + 1);
const movesContent = content.slice(movesStart, movesEnd + 1);

// List of callback function names to extract (with "on" prefix)
const callbackNames = [
  'onHit',
  'onBasePower',
  'onModifyMove',
  'onAfterMoveSecondary',
  'onTry',
  'onTryHit',
  'onTryMove',
  'onEffectiveness',
  'onModifyDefensiveCategory',
  'onModifyAtk',
  'onModifySpA',
  'onModifySpD',
  'onModifyDef',
  'onModifySpe',
  'onMoveFail',
  'onPrepareHit',
  'onSourceAfterMove',
  'onAfterMove',
  'onEffect',
  'onStart',
  'onResidual',
  'onDamage',
  'onDamagingHit',
  'onSwitchIn',
  'onEnd',
  'onModifySTAB',
  'onModifyType',
  'onFoeTrapPokemon',
  'onFoeMaybeTrapPokemon',
  'onFoeTryMove',
  'onAllyTryAddVolatile',
  'onFoeTryEatItem',
  'onSourceAfterFaint',
  'onTryEatItem',
  'onTryImmunity',
  'onModifyPriority',
  'onModifyAccuracy',
  'onResidualOrder',
  'onTryHitPriority',
  'onBasePowerPriority',
  'onEffectivenessPriority',
  'onModifyTypePriority',
  'onDamagePriority',
  'onDamagingHitPriority',
  'onSecondary',
  'onAllyBasePower',
  'onWeatherChange',
  'onTerrainChange',
  'onForceSwitch',
  'onDragOut',
  'onDynamax',
  'onTeraStall',
  'onTeraNormalize',
  'onTypeAdd',
  'onTryPrimaryHit',
  'onAnyBoost',
  'onSetStatus',
  'onUpdate',
  'onMaybeTrapPokemon',
  'onTrapPokemon',
  'onAllyModifyPriority',
  'onAfterMoveSecondarySelf',
  'onSubFraction',
  'onKeyDown',
  'onKeyUp',
  'onPrimal',
  'onRestart',
  'onType',
  'onDisableMove',
  'onMoveAltered',
  'onValidateSet',
  'onModifySpecies',
  'onPreStart',
  'onFaint',
  'onBeforeMove',
  'onBeforeTurn',
  'onAnyModifyAccuracy',
  'onAccuracy',
  'onModifyDamage',
  'onAnyModifyDamage',
  'onFractionalDamage',
  'onModifyPower',
  'onRedirectMove',
  'onTryRedirectMove',
  'onTryHitSelf',
  'onTryAddVolatile',
  'onFoeTryAddVolatile',
  'onBoost',
  'onTryBoost',
  'onAllyBoost',
  'onFoeBoost',
  'onHeal',
  'onTryHeal',
  'onAllyHeal',
  'onFoeHeal',
  'onRecievedDamage',
  'onRecoilDamage',
  'onAfterDamageOrder',
  'onAfterDamage',
  'onSourceAfterDamage',
  'onAfterDamagePass',
  'onSideAfterDamage',
  'onAllyAfterDamage',
  'onAfterHits',
  'onAfterSubDamage',
  'onCriticalHit',
  'onSuperEffectiveHit',
  'onEffectivenessFromTarget',
  'onPrimaryHit',
  'onFailMove',
  'onModifyCritRatio',
  'onModifySecondaries',
  'onTrySecondaryHit',
  'onAllySecondaryHit',
  'onAllyResidual',
  'onAllyStart',
  'onSideStart',
  'onSideResidual',
  'onSideEnd',
  'onBattleStart',
  'onDuringMove',
  'onModifyMovePP',
  'onStallMove',
  'onSwitchOut',
  'onDragOutEnd',
  'onSwitchOutError',
  'onBeforeSwitchOut',
  'onSwitchInError',
  'onEntryHazard',
  'onEntryDamage',
  'onHitFields',
  'onOpponentBoost',
  'onOpponentDamage',
  'onSingleOpponentBoost',
  'onWonderGuard',
  'onImmunity',
  'onSpikeImmunity',
  'onGlitchDowngrade',
  'onDynamaxCancellation',
];

// Parse each move entry
const moves: Record<string, any> = {};
const moveEffects: Record<string, any> = {};

// Simple parser to extract move entries
let remaining = movesContent.slice(1, -1); // Remove outer braces
let match;

// Regular expression to match move keys
const keyRegex = /^\s*["']?([a-zA-Z0-9-]+)["']?\s*:\s*\{/y;

while (remaining.length > 0) {
  // Find next move key
  keyRegex.lastIndex = 0;
  match = keyRegex.exec(remaining);
  if (!match) {
    // Skip any trailing commas or whitespace
    const trailing = remaining.match(/^[\s,]+/);
    if (trailing) {
      remaining = remaining.slice(trailing[0].length);
      continue;
    }
    break;
  }

  const moveId = match[1];
  const braceStart = match.index + match[0].length - 1;
  const braceEnd = findMatchingBrace(remaining, braceStart + 1);

  const moveObjStr = remaining.slice(braceStart, braceEnd + 1);
  remaining = remaining.slice(braceEnd + 1);

  // Extract callbacks and handlers
  const handlers: string[] = [];
  const callbacks: Record<string, string> = {};
  let cleanMoveStr = moveObjStr;

  for (const callbackName of callbackNames) {
    // Match both: callbackName(...) { and callbackNamePriority: number
    const priorityRegex = new RegExp(`["']?${callbackName}Priority["']?\\s*:\\s*([0-9.-]+)\\s*,?`, 'g');
    let priorityMatch;
    while ((priorityMatch = priorityRegex.exec(moveObjStr)) !== null) {
      handlers.push(`${callbackName}Priority`);
      callbacks[`${callbackName}Priority`] = priorityMatch[1];
      cleanMoveStr = cleanMoveStr.replace(priorityMatch[0], '');
    }

    // Match function definitions
    const funcRegex = new RegExp(`["']?${callbackName}["']?\\s*\\([^)]*\\)\\s*\\{`, 's');
    const funcMatch = moveObjStr.match(funcRegex);
    if (funcMatch) {
      const funcStart = funcMatch.index!;
      const funcBodyStart = moveObjStr.indexOf('{', funcStart);
      const funcBodyEnd = findMatchingBrace(moveObjStr, funcBodyStart + 1);
      const funcFull = moveObjStr.slice(funcStart, funcBodyEnd + 1);

      // Extract just the function definition
      handlers.push(callbackName);
      callbacks[callbackName] = funcFull.replace(new RegExp(`^["']?${callbackName}["']?\\s*`), '');

      // Remove from clean string
      cleanMoveStr = cleanMoveStr.replace(funcFull, '');
    }
  }

  // Also handle nested "self" or "condition" objects with callbacks
  const nestedRegex = /(\w+)\s*:\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let nestedMatch;
  const nestedCopy = cleanMoveStr;
  while ((nestedMatch = nestedRegex.exec(nestedCopy)) !== null) {
    const nestedName = nestedMatch[1];
    const nestedContent = nestedMatch[2];

    // Check if nested object contains callbacks
    let hasCallback = false;
    for (const callbackName of callbackNames) {
      if (nestedContent.includes(callbackName)) {
        hasCallback = true;
        break;
      }
    }

    if (hasCallback) {
      // Extract entire nested object
      const nestedStart = nestedMatch.index;
      const nestedBraceStart = nestedMatch[0].indexOf('{');
      const nestedBraceEnd = findMatchingBrace(nestedMatch[0], nestedBraceStart + 1);
      const nestedFull = nestedMatch[0].slice(0, nestedBraceEnd + 1);

      callbacks[nestedName] = nestedFull.replace(new RegExp(`^${nestedName}\\s*:\\s*`), '');
      handlers.push(nestedName);
      cleanMoveStr = cleanMoveStr.replace(nestedFull, '');
    }
  }

  // Clean up trailing commas and parse as JSON
  try {
    // Prepare for JSON parsing by removing trailing commas
    let jsonReady = cleanMoveStr
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/(['"])?([a-zA-Z_][a-zA-Z0-9_]*)(['"])?\s*:/g, '"$2":'); // Quote keys

    // Handle unquoted string values like "Physical", "Normal", etc.
    // This is complex, so we use a simpler approach: evaluate as JS and stringify

    // Safe evaluation in this context (we control the input)
    const moveData = eval(`(${cleanMoveStr})`);

    // Add handlers if any
    if (handlers.length > 0) {
      moveData._handlers = handlers;
    }

    moves[moveId] = moveData;

    if (Object.keys(callbacks).length > 0) {
      moveEffects[moveId] = callbacks;
    }
  } catch (e) {
    console.error(`Error parsing ${moveId}:`, e);
    console.log(cleanMoveStr.slice(0, 500));
    // Fallback: store as is and manually fix later
    moves[moveId] = { _error: 'parse failed', _raw: cleanMoveStr.slice(0, 200) };
  }
}

// Write JSON output
const jsonOutputPath = '/home/jacobi/Code/zukan/src/core/data/json/moves.json';
fs.writeFileSync(jsonOutputPath, JSON.stringify(moves, null, 2));
console.log(`Wrote ${Object.keys(moves).length} moves to ${jsonOutputPath}`);

// Write TypeScript effects output
const tsOutputPath = '/home/jacobi/Code/zukan/src/core/data/effects/move-effects.ts';
let tsOutput = `import type { MoveData } from "../../sim/dex-moves";

/**
 * Move handler functions extracted from moves.ts
 * Pure data fields (name, num, accuracy, basePower, pp, etc.) are in moves.json
 */
export const moveHandlers: Record<string, Partial<MoveData>> = {
`;

for (const [moveId, handlers] of Object.entries(moveEffects)) {
  tsOutput += `  ${JSON.stringify(moveId)}: {\n`;
  for (const [handlerName, handlerCode] of Object.entries(handlers)) {
    if (handlerName.endsWith('Priority')) {
      tsOutput += `    ${handlerName}: ${handlerCode},\n`;
    } else if (typeof handlerCode === 'string' && handlerCode.startsWith('{')) {
      // Nested object
      tsOutput += `    ${handlerName}: ${handlerCode},\n`;
    } else {
      // Function
      tsOutput += `    ${handlerName}${handlerCode},\n`;
    }
  }
  tsOutput += `  },\n`;
}

tsOutput += `};\n`;

fs.writeFileSync(tsOutputPath, tsOutput);
console.log(`Wrote ${Object.keys(moveEffects).length} move effects to ${tsOutputPath}`);
