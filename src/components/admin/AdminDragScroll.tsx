'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useRef } from 'react';

type AdminDragScrollProps = {
  children: React.ReactNode;
  className?: string;
};

const DRAG_THRESHOLD_PX = 6;

/**
 * Horizontal overflow container with click-drag scrolling for wide admin tables.
 */
export function AdminDragScroll(props: AdminDragScrollProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    dragging: boolean;
    moved: boolean;
  } | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target;
    if (
      target instanceof Element
      && target.closest('a, button, input, select, textarea, label, [role="button"]')
    ) {
      return;
    }

    const scroller = scrollerRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) {
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: scroller.scrollLeft,
      dragging: false,
      moved: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragRef.current;
    const scroller = scrollerRef.current;
    if (!state || !scroller || state.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - state.startX;
    if (!state.dragging && Math.abs(deltaX) < DRAG_THRESHOLD_PX) {
      return;
    }

    if (!state.dragging) {
      state.dragging = true;
      state.moved = true;
      scroller.setPointerCapture(event.pointerId);
      scroller.classList.add('cursor-grabbing', 'select-none');
    }

    scroller.scrollLeft = state.startScrollLeft - deltaX;
    event.preventDefault();
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragRef.current;
    const scroller = scrollerRef.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }

    if (state.dragging && scroller?.hasPointerCapture(event.pointerId)) {
      scroller.releasePointerCapture(event.pointerId);
    }
    scroller?.classList.remove('cursor-grabbing', 'select-none');
    dragRef.current = null;
  };

  return (
    <div
      className={`overflow-x-auto overscroll-x-contain cursor-grab active:cursor-grabbing ${props.className ?? ''}`}
      onPointerCancel={endDrag}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      ref={scrollerRef}
    >
      {props.children}
    </div>
  );
}
