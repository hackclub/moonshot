"use client";

import { useRef } from 'react';
import ClientEffects from './ClientEffects';
import './faq.css';

export default function FAQ() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickersLayerRef = useRef<HTMLDivElement | null>(null);

  // Move effects to a separate client component to avoid layout flashes

  return (
    <div ref={containerRef} className="faq-standalone">
      <ClientEffects />
      <div className="stars" aria-hidden="true">
        <div className="star"></div>
        <div className="star"></div>
        <div className="star"></div>
        <div className="star"></div>
        <div className="star"></div>
      </div>

      <div className="floating-stickers" id="faq-stickers" ref={stickersLayerRef} aria-hidden="true"></div>

      {/* Back to RSVP button removed */}

      <div id="faq-container" className="container">
        <h1 className="title">🚀 Moonshot FAQ</h1>

        <div className="intro-section">
          <h2>What is Moonshot? 🌙</h2>
          <p><em>Please note, day-of logistics, such as schedules or suggested packing lists, are subject to change. We will provide more specific instructions to participants closer to the event.</em></p>
          <p>You and <strong>100 Hack Clubbers</strong> will fly to <strong>Orlando, Florida, December 12–15</strong>.</p>
          <p><strong>Hack by day</strong>, then head out on <strong>unforgettable excursions</strong>:</p>
          <ul>
            <li><strong>A trip to Universal Studios</strong></li>
            <li><strong>Visit Kennedy Space Center and Potentially watch a rocket launch</strong></li>
          </ul>
        </div>

        <div className="intro-section">
          <h2>Channels 📢</h2>
          <p><strong><a href="https://hackclub.slack.com/archives/C09J2HHRQ95" target="_blank">#moonshot</a></strong> → just meet people and talk about everything!</p>
          <p><strong><a href="https://hackclub.slack.com/archives/C09JYACF58D" target="_blank">#moonshot-help</a></strong> → if you have questions (please read the FAQ first!)</p>
          <p><strong><a href="https://hackclub.slack.com/archives/C09JMHAF0J0" target="_blank">#moonshot-bulletin</a></strong> → for news and updates</p>
        </div>

        <div className="section-heading rules">💫 RULES 💫</div>

        <div className="faq-item">
          <div className="faq-question">
            <span>📍 WHAT COUNTS AND TRACKING SYSTEM</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              There is no specific theme required, just remember to follow the approval requirements. You can work with:<br /><br />
              • <strong>Software</strong> → Track time with <a href="https://hackatime.hackclub.com/" target="_blank">Hackatime</a> (if you have problems setting it up, ask for help in the Slack channel <a href="https://hackclub.slack.com/archives/C08MDGUPJ6A" target="_blank">#hackatime-v2</a>)<br />
              • <strong>Hardware</strong> → Track time with <a href="#journaling-system">journaling system</a><br />
              • <strong>Video editing and art</strong> (MAX. 10% of overall time) → Track time with <a href="#journaling-system">journaling system</a>
            </div>
          </div>
        </div>

        <div className="faq-item" id="journaling-system">
          <div className="faq-question">
            <span>📍 JOURNALING SYSTEM</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              <em>(temporary method until the Launchpad release)</em><br /><br />
              • Take photos/screenshots of your improvements<br />
              • Record quick update videos<br />
              • Write a brief description of the changes<br /><br />
              Please do this for each new feature (ideally around every hour of work), put everything in your Github commits.
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>📍 APPROVAL REQUIREMENTS</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              • 75+ hours correctly tracked<br />
              • Github opensource repository, with frequent and detailed commits (for each new feature, ideally around every 30min-1h of work)<br />
              • No fraud, double-dipping or other broken rules
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>📍 RULES</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              ✅ AI (only as support)<br />
              ❌ Double-dipping with other programs<br />
              ❌ FRAUD<br /><br />
              <em className="warning">Don't cheat the time tracking system. No bots, no fake key presses, no UI manipulation. If you do, you'll be banned from Hackatime and other participating YSWS / events / programs</em>
            </div>
          </div>
        </div>

        <div className="section-heading faq">❓ FAQ SECTION ❓</div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Is airfare covered as part of the 75 hours I need to work to attend?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              No. Travel stipends will be available within the Moonshop at a minimum rate of $10/hr. Your airfare must be covered by yourself personally, or alternatively thru earning stipends.
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>How do I get invited?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              Log your hours, work on your project for 75 hours and ship it on Launchpad
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Who Can Participate?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              Anyone between the ages of 13 and 18 (included) can participate in Moonshot!
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>What if I complete Launchpad but can't attend Moonshot?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              You will be able to redeem the hours you spent making projects in a shop for fun, neat prizes!
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Is Participation Free?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              Yes! Participation is entirely free, but only if you complete Launchpad. Without shipping your projects on Launchpad, you won't be able to join Moonshot.
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>How Do I Register?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              <a href="https://moonshot.hackclub.com/" target="_blank" rel="noopener noreferrer">Signup here</a>!
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Can I start?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              Yes, track your hours with Hackatime or use the journaling system
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Is the flight stipend covered?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              You can redeem your flight stipend in the Moonshop using your hours (coming soon...)
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Can I collab with my friends and make a single project?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              Yes BUT:<br />
              1. You can work on the same repo but in different forks<br />
              2. your hours will be obv counted separately
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Can I ship a private (or partially private) project?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              No, your project MUST be open source, otherwise hours will not be counted.
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Can I work in already started projects?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              It's fine if you work on a project that has been associated w/ another program or already started - you can continue it - but we will only take hours from the beginning of the moonshot announcement. We HIGHLY suggest to create a new Github repository, it's not mandatory, but it will increase your chances of being approved, and will make the process much faster.
            </div>
          </div>
        </div>

        <div className="faq-item contact">
          <div className="faq-question">
            <span>📍 STILL HAVE QUESTIONS?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              Ask directly in the HC Slack channel <strong><a href="https://hackclub.slack.com/archives/C09JYACF58D" target="_blank">#moonshot-help</a></strong> or email <strong>moonshot@hackclub.com</strong>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ styles are imported from ./faq.css for first-paint styling */}
    </div>
  );
}