import html2canvas from 'html2canvas';

export const exportChartAsImage = async (element: HTMLElement | null, filename: string) => {
  if (!element) return;
  
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#030712',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('导出失败:', error);
    alert('导出失败，请重试');
  }
};
