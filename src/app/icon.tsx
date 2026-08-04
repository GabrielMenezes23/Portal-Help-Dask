import { ImageResponse } from 'next/og';

import { TI_SYMBOL_DATA_URI } from '@/assets/ti-symbol-data';

export const size = {
  width: 64,
  height: 64,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        <img
          src={TI_SYMBOL_DATA_URI}
          alt=""
          width="58"
          height="58"
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    size,
  );
}
