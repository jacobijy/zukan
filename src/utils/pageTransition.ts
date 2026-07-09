const TAB_TRANSITION_DIRECTION_KEY = 'tab_transition_direction';

export const PAGE_SWITCH_DELAY = 220;

const getTabDirection = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return 0;
    return toIndex > fromIndex ? 1 : -1;
};

export const setTabTransitionDirection = (fromIndex: number, toIndex: number) => {
    uni.setStorageSync(TAB_TRANSITION_DIRECTION_KEY, getTabDirection(fromIndex, toIndex));
};

export const consumeTabTransitionDirection = () => {
    const stored = uni.getStorageSync(TAB_TRANSITION_DIRECTION_KEY);
    uni.removeStorageSync(TAB_TRANSITION_DIRECTION_KEY);

    const direction = Number(stored);
    return direction === 1 || direction === -1 ? direction : 0;
};

export const getEnterTransformX = (direction: number) => {
    if (direction > 0) return '22px';
    if (direction < 0) return '-22px';
    return '0px';
};

export const getLeaveTransformX = (fromIndex: number, toIndex: number) => {
    const direction = getTabDirection(fromIndex, toIndex);
    if (direction > 0) return '-22px';
    if (direction < 0) return '22px';
    return '0px';
};
