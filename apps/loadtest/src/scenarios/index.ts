import type { ConcreteScenarioId } from '../core/types.js';
import { apiScenario } from './api.js';
import { gameplayScenario } from './gameplay.js';
import { socketBasicScenario } from './socketBasic.js';
import { socketRoomsScenario } from './socketRooms.js';
import type { Scenario } from './types.js';

export const SCENARIOS: Record<ConcreteScenarioId, Scenario> = {
  api: apiScenario,
  'socket-basic': socketBasicScenario,
  'socket-rooms': socketRoomsScenario,
  gameplay: gameplayScenario,
};
