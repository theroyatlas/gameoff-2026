/** 相對於打包後 HTML 的位置；兩版一起部署時在此設定 2D 入口。 */
export const TWO_D_URL = '../../../dist/index.html';

/** 可用 ?quality=low 重現較低的繪圖預算，並非硬體 GPU 模擬器。 */
export const LOW_GPU_PROFILE = new URLSearchParams(location.search).get('quality') === 'low';
