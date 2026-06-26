import { useState, useRef, useCallback, useMemo } from 'react';

const VirtualList = ({ items, itemHeight, height, renderItem, overscan = 5 }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);
  const totalHeight = items.length * itemHeight;

  const { startIndex, endIndex, offsetY } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(height / itemHeight) + overscan * 2;
    const end = Math.min(items.length, start + visibleCount);
    const offset = start * itemHeight;
    return { startIndex: start, endIndex: end, offsetY: offset };
  }, [scrollTop, items.length, itemHeight, height, overscan]);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex).map((item, idx) => ({
      item,
      index: startIndex + idx,
    }));
  }, [items, startIndex, endIndex]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height, overflow: 'auto' }}
      className="virtual-list-container"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map(({ item, index }) => (
            <div key={item.id || index} style={{ height: itemHeight }}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VirtualList;
