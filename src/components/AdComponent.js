// components/AdComponent.js
import React, { useEffect } from 'react';

const AdComponent = () => {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error(e);
    }
  }, []);

  return (
  // <!-- image compressor unit -->
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-5081075244751659"
     data-ad-slot="7917249899"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
  );
};

export default AdComponent;
