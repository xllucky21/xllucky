import html2canvas from 'html2canvas';

export const exportChartAsImage = async (
  element: HTMLElement | null,
  filename: string
): Promise<boolean> => {
  if (!element) return false;
  
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#111827', // gray-900
      scale: 2,
      useCORS: true,
      logging: false,
    });
    
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.download = `${filename}_${date}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    return true;
  } catch (error) {
    console.error('导出失败:', error);
    return false;
  }
};
