import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { useZoomPan } from '../hooks/useZoomPan.js';

function TestViewer() {
  const {
    containerRef,
    imageRef,
    handleZoomIn,
    handleImageLoad,
    imageStyle,
  } = useZoomPan(true);

  return (
    <div>
      <button onClick={handleZoomIn}>zoom</button>
      <div data-testid="container" ref={containerRef} style={{ width: 200, height: 200 }}>
        <img
          data-testid="img"
          ref={imageRef}
          onLoad={handleImageLoad}
          src="test.jpg"
          alt="test"
          style={imageStyle}
        />
      </div>
    </div>
  );
}

describe('useZoomPan', () => {
  test('allows panning after zoom', () => {
    const { getByTestId, getByText } = render(<TestViewer />);
    const img = getByTestId('img');
    const container = getByTestId('container');

    Object.defineProperty(img, 'naturalWidth', { value: 300 });
    Object.defineProperty(img, 'naturalHeight', { value: 300 });
    Object.defineProperty(container, 'offsetWidth', { value: 200 });
    Object.defineProperty(container, 'offsetHeight', { value: 200 });

    fireEvent.load(img);

    const zoomBtn = getByText('zoom');
    for (let i = 0; i < 6; i++) {
      fireEvent.click(zoomBtn);
    }

    fireEvent.mouseDown(container, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 1000, clientY: 1000 });
    fireEvent.mouseUp(document);

    const transformAfterDrag = img.style.transform;
    expect(transformAfterDrag).toBe('translate(380px, 380px) scale(2.1)');

    fireEvent.mouseDown(container, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: -1000, clientY: -1000 });
    fireEvent.mouseUp(document);

    const transformAfterDrag2 = img.style.transform;
    expect(transformAfterDrag2).toBe('translate(-380px, -380px) scale(2.1)');
  });
});
