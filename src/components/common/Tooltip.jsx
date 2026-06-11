import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/scale.css';

function Tooltip({ children, content, placement = 'right' }) {
  if (!content) return children;
  
  return (
    <Tippy
      content={content}
      placement={placement}
      animation="scale"
      duration={200}
      theme="custom"
      arrow={true}
      delay={[300, 0]}
    >
      {children}
    </Tippy>
  );
}

export default Tooltip;