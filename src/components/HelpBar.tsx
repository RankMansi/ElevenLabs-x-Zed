import React from 'react';

export const HelpBar: React.FC = () => {
  return (
    <div className="hud-strip-bottom">
      <div className="help-bar">
        <span>
          <span className="key">ARROWS</span>
          {' '}move
        </span>
        <span>·</span>
        <span>
          <span className="key">ESC</span>
          {' '}pause
        </span>
      </div>
    </div>
  );
};
