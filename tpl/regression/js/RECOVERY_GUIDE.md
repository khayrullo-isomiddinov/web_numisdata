# Regression Performance Optimization - Recovery Archive

This document contains all the necessary logic and instructions to re-apply the performance optimizations to the regression module once client authorization is obtained.

## Summary of Changes
- **Shared Promise**: Implemented `bootstrap_promise` to prevent concurrent heavy calculations.
- **On-Demand CI**: Switched from a 1,500-point fixed grid to calculating Confidence Intervals only for the specific coins present in search results.
- **Vectorized Logs**: Pre-calculates logarithms outside the bootstrap loop for a ~5x speedup.

## Recovery Instructions

To re-apply the optimization:
1.  Replace the contents of `tpl/regression/js/regression_logic.js` with the contents of `tpl/regression/js/regression_logic.optimized.js`.
2.  Re-run the Rollup bundling command:
    ```bash
    rollup tpl/regression/js/regression.js --file tpl/regression/js/regression-min.js --format iife --name regression_min
    ```

## Optimized Logic (Backup)

The full optimized code is stored in: [regression_logic.optimized.js](file:///Users/paco/Trabajos/web_projects/web_mib/tpl/regression/js/regression_logic.optimized.js)
