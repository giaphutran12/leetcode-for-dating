"use client";

import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  PropsWithChildren,
} from "react";
import { useEffect, useRef, useState } from "react";
import type { ActivityWeek } from "../domain/activity";

type Intent = "primary" | "secondary" | "brand" | "lime" | "danger";

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function BrandButton({
  intent = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { intent?: Intent }) {
  return (
    <button
      className={classes("rc-button", `rc-button--${intent}`, className)}
      {...props}
    />
  );
}

export function BrandLink({
  intent = "primary",
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { intent?: Intent }) {
  return (
    <a
      className={classes("rc-button", `rc-button--${intent}`, className)}
      {...props}
    />
  );
}

export function BrandBadge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "brand" | "lime";
}) {
  return (
    <span
      className={classes("rc-badge", `rc-badge--${tone}`, className)}
      {...props}
    />
  );
}

export function BrandSurface({
  tone = "raised",
  className,
  ...props
}: PropsWithChildren<
  HTMLAttributes<HTMLElement> & {
    tone?: "raised" | "brand" | "ink";
  }
>) {
  return (
    <section
      className={classes("rc-surface", `rc-surface--${tone}`, className)}
      {...props}
    />
  );
}

export function BrandKicker({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={classes("rc-kicker", className)} {...props} />;
}

export function RizzMeter({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const bounded = Math.min(100, Math.max(0, value));

  return (
    <div
      className={classes("rc-meter", className)}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={bounded}
    >
      <span className="rc-meter__track" aria-hidden="true">
        <span className="rc-meter__fill" style={{ width: `${bounded}%` }} />
        <span className="rc-meter__thumb" style={{ left: `${bounded}%` }} />
      </span>
    </div>
  );
}

export function ActivityContributionGraph({
  weeks,
  total,
  ariaLabel = "Completed practice attempts by local calendar date",
}: {
  weeks: ActivityWeek[];
  total: number;
  ariaLabel?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    label: string;
    left: number;
    top: number;
  }>();

  useEffect(() => {
    const viewport = scrollRef.current;
    if (viewport) viewport.scrollLeft = viewport.scrollWidth;
  }, [weeks]);

  return (
    <div
      aria-label={ariaLabel}
      className="rc-activity-graph"
      role="group"
    >
      <div
        aria-label="Activity calendar. Scroll horizontally for earlier dates."
        className="rc-activity-graph__scroll"
        ref={scrollRef}
        role="region"
        tabIndex={0}
      >
        <div className="rc-activity-graph__months" aria-hidden="true">
          {weeks.map((week, index) => (
            <span key={`${week.monthLabel ?? "week"}-${index}`}>
              {week.monthLabel ?? ""}
            </span>
          ))}
        </div>
        <div className="rc-activity-graph__body">
          <div className="rc-activity-graph__weekdays" aria-hidden="true">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>
          <ol className="rc-activity-graph__grid">
            {weeks.flatMap((week) =>
              week.days.map((day) => (
                <li
                  aria-label={day.label}
                  data-future={day.future}
                  data-level={day.level}
                  key={day.date}
                  onMouseEnter={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setTooltip({
                      label: day.label,
                      left: rect.left + rect.width / 2,
                      top: rect.top,
                    });
                  }}
                  onMouseLeave={() => setTooltip(undefined)}
                />
              )),
            )}
          </ol>
        </div>
      </div>
      <div className="rc-activity-graph__footer">
        <p>{total} completed {total === 1 ? "rep" : "reps"} shown</p>
        <div
          aria-label="Intensity: zero, one, two, three, and four or more completed attempts"
          className="rc-activity-graph__legend"
        >
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <i data-level={level} key={level} aria-hidden="true" />
          ))}
          <span>More</span>
        </div>
      </div>
      {tooltip && (
        <div
          className="rc-activity-graph__tooltip"
          role="tooltip"
          style={{ left: tooltip.left, top: tooltip.top }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}
