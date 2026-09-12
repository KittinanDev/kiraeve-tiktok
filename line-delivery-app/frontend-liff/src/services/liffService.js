import liff from '@line/liff';

const LIFF_ID = import.meta.env.VITE_LIFF_ID || 'YOUR_LIFF_ID';

export const initLiff = async () => {
  try {
    if (LIFF_ID !== 'YOUR_LIFF_ID') {
      await liff.init({ liffId: LIFF_ID });
      console.log('LIFF initialized successfully!');
      
      if (!liff.isLoggedIn()) {
        liff.login();
        return null;
      }
      
      const profile = await liff.getProfile();
      return {
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        isLoggedIn: true
      };
    }
  } catch (error) {
    console.warn('LIFF init failed or running outside LINE app. Using fallback mock profile.', error);
  }

  // Mock profile fallback for local web browser testing
  return {
    userId: 'U_MOCK_LINE_USER_123',
    displayName: 'คุณลูกค้า (LINE Demo)',
    pictureUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop',
    isLoggedIn: false
  };
};
