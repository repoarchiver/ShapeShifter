import {
  getHiddenLayerIds,
  getSelectedLayerIds,
  getVectorLayer,
} from '../layers/selectors';
import { State } from '../reducer';
import {
  createDeepEqualSelector,
  getAppState,
} from '../selectors';
import { getAnimation } from '../timeline/selectors';
import { AnimationRenderer } from 'app/scripts/animator';
import {
  ActionMode,
  ActionModeUtil,
  ActionSource,
  SelectionType,
} from 'app/scripts/model/actionmode';
import {
  LayerUtil,
  MorphableLayer,
  VectorLayer,
} from 'app/scripts/model/layers';
import { Path } from 'app/scripts/model/paths';
import {
  Animation,
  PathAnimationBlock,
} from 'app/scripts/model/timeline';
import * as _ from 'lodash';
import {
  createSelector,
  createStructuredSelector,
} from 'reselect';

const getActionModeState = createSelector(getAppState, s => s.actionmode);
const getBlockId = createSelector(getActionModeState, s => s.blockId);
const getBlock =
  createSelector(
    [getAnimation, getBlockId],
    (anim, blockId) => {
      if (!blockId) {
        return undefined;
      }
      const block = _.find(anim.blocks, b => b.id === blockId);
      return block instanceof PathAnimationBlock ? block : undefined;
    },
  );
const getBlockLayerId = createSelector(getBlock, b => b ? b.layerId : undefined);

export const getActionMode = createSelector(getActionModeState, s => s.mode);
export const isActionMode = createSelector(getActionMode, mode => mode !== ActionMode.None);
export const getActionModeHover = createDeepEqualSelector(getActionModeState, s => s.hover);

export const getActionModeSelections =
  createDeepEqualSelector(getActionModeState, s => s.selections);

export const getActionModeSubPathSelections =
  createDeepEqualSelector(
    getActionModeSelections,
    selections => selections.filter(s => s.type === SelectionType.SubPath),
  );
export const getActionModeSegmentSelections =
  createDeepEqualSelector(
    getActionModeSelections,
    selections => selections.filter(s => s.type === SelectionType.Segment),
  );
export const getActionModePointSelections =
  createDeepEqualSelector(
    getActionModeSelections,
    selections => selections.filter(s => s.type === SelectionType.Point),
  );

const getPairedSubPaths =
  createDeepEqualSelector(getActionModeState, state => state.pairedSubPaths);
const getUnpairedSubPath =
  createDeepEqualSelector(getActionModeState, state => state.unpairedSubPath);

function getVectorLayerValue(getTimeFn: (block: PathAnimationBlock) => number) {
  return createSelector(
    [getVectorLayer, getAnimation, getBlock],
    (vl, anim, block) => {
      if (!block) {
        return undefined;
      }
      // Note this is a bit dangerous because the renderer interpolates paths
      // and that causes all mutated path state to be lost if we aren't careful.
      // There are currently checks in PathProperty.ts to avoid this by returning
      // the start and end path when the interpolated fraction is 0 and 1 respectively.
      const renderer = new AnimationRenderer(vl, anim);
      return renderer.setAnimationTime(getTimeFn(block));
    });
}

const getVectorLayerFromValue = getVectorLayerValue(block => block.startTime);
const getVectorLayerToValue = getVectorLayerValue(block => block.endTime);

type CombinerFunc = (vl: VectorLayer, anim: Animation, block: PathAnimationBlock) => VectorLayer;

function getMorphableLayerValue(selector: Reselect.OutputSelector<State, VectorLayer, CombinerFunc>) {
  return createSelector(
    [selector, getBlockLayerId],
    (vl, blockLayerId) => {
      if (!vl || !blockLayerId) {
        return undefined;
      }
      return vl.findLayerById(blockLayerId) as MorphableLayer;
    });
}

const getMorphableLayerFromValue = getMorphableLayerValue(getVectorLayerFromValue);
const getMorphableLayerToValue = getMorphableLayerValue(getVectorLayerToValue);

const getPathsCompatibleResult =
  createSelector(
    getBlock,
    block => block ? ActionModeUtil.checkPathsCompatible(block) : undefined,
  );

function getHighlightedSubIdxWithError(actionSource: ActionSource) {
  return createSelector(
    [getActionMode, getActionModeSelections, getPathsCompatibleResult],
    (mode, selections, result) => {
      if (!result) {
        // Then there is no path animation block currently selected.
        return undefined;
      }
      const { areCompatible, errorPath, errorSubIdx } = result;
      if (mode !== ActionMode.Selection || selections.length) {
        // Don't show any highlights if we're not in selection mode, or
        // if there are any existing selections.
        return undefined;
      }
      if (areCompatible || errorPath !== actionSource || errorSubIdx === undefined) {
        return undefined;
      }
      return errorSubIdx;
    },
  );
}

const actionModeBaseSelectors = {
  blockLayerId: getBlockLayerId,
  isActionMode,
  hover: getActionModeHover,
  selections: getActionModeSelections,
  pairedSubPaths: getPairedSubPaths,
  unpairedSubPath: getUnpairedSubPath,
  hiddenLayerIds: getHiddenLayerIds,
  selectedLayerIds: getSelectedLayerIds,
};

export const getActionModeStartState =
  createStructuredSelector({
    ...actionModeBaseSelectors,
    vectorLayer: getVectorLayerFromValue,
    subIdxWithError: getHighlightedSubIdxWithError(ActionSource.From),
  });

export const getActionModeEndState =
  createStructuredSelector({
    ...actionModeBaseSelectors,
    vectorLayer: getVectorLayerToValue,
    subIdxWithError: getHighlightedSubIdxWithError(ActionSource.To),
  });

export const getToolbarState =
  createStructuredSelector({
    actionMode: getActionMode,
    fromMl: getMorphableLayerFromValue,
    toMl: getMorphableLayerToValue,
    mode: getActionMode,
    selections: getActionModeSelections,
    unpairedSubPath: getUnpairedSubPath,
    block: getBlock,
  });