export const throttle = (fn: () => void, ms = 16) => {
    let throttled = false;
    return () => {
        if (throttled) {
            return;
        }
        throttled = true;
        const now = performance.now();
        requestAnimationFrame(function f(timestamp) {
            if (timestamp - now > ms) {
                throttled = false;
                fn();
            } else {
                requestAnimationFrame(f);
            }
        });
    }
};