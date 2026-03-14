'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FC,
  type ReactNode,
  type KeyboardEvent,
} from 'react';

interface DropdownItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

const Dropdown: FC<DropdownProps> = ({ trigger, items, align = 'left' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | HTMLButtonElement | null)[]>([]);

  const close = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + items.length) % items.length);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0) {
          const item = items[focusedIndex];
          item.onClick?.();
          close();
        }
        break;
    }
  };

  // Focus the active item when focusedIndex changes
  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  const renderItem = (item: DropdownItem, index: number) => {
    const commonClasses = `
      flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700
      hover:bg-gray-100 focus:bg-gray-100 focus:outline-none
      ${focusedIndex === index ? 'bg-gray-100' : ''}
    `;

    const content = (
      <>
        {item.icon && <span className="h-4 w-4 text-gray-400">{item.icon}</span>}
        {item.label}
      </>
    );

    if (item.href) {
      return (
        <a
          key={index}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          href={item.href}
          className={commonClasses}
          role="menuitem"
          tabIndex={-1}
          onClick={close}
        >
          {content}
        </a>
      );
    }

    return (
      <button
        key={index}
        ref={(el) => {
          itemRefs.current[index] = el;
        }}
        className={commonClasses}
        role="menuitem"
        tabIndex={-1}
        onClick={() => {
          item.onClick?.();
          close();
        }}
      >
        {content}
      </button>
    );
  };

  return (
    <div ref={containerRef} className="relative inline-block" onKeyDown={handleKeyDown}>
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        role="button"
        tabIndex={0}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`
            absolute z-40 mt-2 min-w-[12rem] overflow-hidden rounded-lg border border-gray-200
            bg-white py-1 shadow-lg
            ${align === 'right' ? 'right-0' : 'left-0'}
          `}
          role="menu"
          aria-orientation="vertical"
        >
          {items.map(renderItem)}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
