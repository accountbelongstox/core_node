import React from 'react';
import {
  BadgeCheck,
  Blocks,
  CheckCircle2,
  ClipboardList,
  Code2,
  Landmark,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const STEP_ICONS = {
  requirement: [ClipboardList, MessageSquareText, Sparkles],
  cooperation: [Blocks, BadgeCheck, CheckCircle2],
  funding: [Landmark, ShieldCheck, CheckCircle2],
  delivery: [Code2, MessageSquareText, BadgeCheck],
  warranty: [ShieldCheck, ClipboardList, CheckCircle2],
} as const;

export type CmProcessStepId = keyof typeof STEP_ICONS;

export const CmProcessIllustration: React.FC<{ step: CmProcessStepId }> = ({ step }) => {
  const [PrimaryIcon, SecondaryIcon, StatusIcon] = STEP_ICONS[step];

  return (
    <div className="cm-process-illustration" data-step={step} aria-hidden="true">
      <div className="cm-process-illustration__glow" />
      <div className="cm-process-illustration__window">
        <div className="cm-process-illustration__window-bar">
          <span /><span /><span />
        </div>
        <div className="cm-process-illustration__window-body">
          <div className="cm-process-illustration__sidebar">
            <PrimaryIcon />
            <span /><span /><span />
          </div>
          <div className="cm-process-illustration__canvas">
            <div className="cm-process-illustration__title-line" />
            <div className="cm-process-illustration__row">
              <SecondaryIcon />
              <span />
              <StatusIcon />
            </div>
            <div className="cm-process-illustration__row cm-process-illustration__row--short">
              <SecondaryIcon />
              <span />
              <StatusIcon />
            </div>
            <div className="cm-process-illustration__footer-line" />
          </div>
        </div>
      </div>
      <div className="cm-process-illustration__badge"><StatusIcon /></div>
    </div>
  );
};

export default CmProcessIllustration;
