/** Verbatim content of the Global Shapers Community Charter, kept in
 *  English only regardless of site locale — this is an official World
 *  Economic Forum / Global Shapers document, and translating it risks the
 *  wording drifting from the source text. Only the page chrome around it
 *  (title, back link, table of contents label) is localized.
 *
 *  To edit: this is the source of truth for the whole page. `marker`
 *  reproduces the Charter's own numbering (e.g. "1.1"); omit it for a
 *  plain dash-bullet item (e.g. the Code of Conduct's list of unacceptable
 *  behaviors, which the source document doesn't number). `subItems` are
 *  the nested dash-bullets under a single numbered item (e.g. 6.1's two
 *  Alumni-eligibility conditions, or 13.1/13.2's cancellation grounds).
 */

export interface CharterItem {
  marker?: string;
  text: string;
  subItems?: string[];
}

export interface CharterBlock {
  paragraphs?: string[];
  items?: CharterItem[];
  footnote?: string;
}

export interface CharterSection {
  id: string;
  title: string;
  blocks: CharterBlock[];
}

export const CHARTER_INTRO: CharterSection = {
  id: 'introduction',
  title: 'Introduction and Background',
  blocks: [
    {
      paragraphs: [
        'The Global Shapers Community, established in 2011 and based in Geneva, Switzerland, operates as an independent, non-profit foundation under Swiss law. It is not affiliated with any political, ideological, or partisan interests.',
        'The community benefits from the operational support of the World Economic Forum (the Forum), including financial assistance, staff involvement, and technological resources.',
        'Our Charter reflects best practices identified since the Community’s inception. It ensures fairness, inclusion, accountability, and shared responsibility across the network. By joining, all members agree to uphold the principles outlined in this Charter.',
      ],
    },
  ],
};

export const CHARTER_SECTIONS: CharterSection[] = [
  {
    id: 'purpose-and-principles',
    title: 'Purpose and Principles',
    blocks: [
      {
        items: [
          { marker: '1.1', text: 'The Global Shapers Community inspires and connects young changemakers around the world.' },
          { marker: '1.2', text: 'Our mission is to develop youth leaders, accelerate youth-led action, and amplify youth voices.' },
          { marker: '1.3', text: 'Through a decentralized hub model, members deliver local projects to foster innovation and collective action.' },
          { marker: '1.4', text: 'Global Shapers are connected globally via technology, training, and events.' },
          { marker: '1.5', text: 'Affiliation with the World Economic Forum provides access to global platforms and fosters intergenerational collaboration.' },
        ],
      },
    ],
  },
  {
    id: 'membership-opportunities',
    title: 'Membership Opportunities',
    blocks: [
      {
        paragraphs: ['By joining the Global Shapers Community, young changemakers:'],
        items: [
          { marker: '2.1', text: 'Join both a local hub and a global network of inspiring young leaders.' },
          { marker: '2.2', text: 'Build life-long friendships that enhance their personal and collective impact.' },
          { marker: '2.3', text: 'Gain practical skills through training, mentorship, and hands-on local and global projects.' },
          { marker: '2.4', text: 'Participate in in-person and virtual events to exchange ideas with peers and the Forum’s wider network.' },
          { marker: '2.5', text: 'Use the digital platform TopLink to collaborate locally and globally.' },
          { marker: '2.6', text: 'Request a transfer to another hub if relocating to a new area.*' },
        ],
        footnote: '* To request a hub transfer, members email globalshapers@weforum.org with the Curators of both the outgoing and incoming hubs in copy. Hubs may opt out of automatic transfers if requests exceed 25% of their total size. In such cases, members must reapply to the new hub following its selection process.',
      },
    ],
  },
  {
    id: 'membership-criteria-and-diversity',
    title: 'Membership Criteria and Diversity',
    blocks: [
      {
        paragraphs: ['Global Shapers are selected at the hub level. Members must:'],
        items: [
          { marker: '3.1', text: 'Be between 18 and 27 years old when joining the hub.' },
          { marker: '3.2', text: 'Demonstrate potential to drive social change or show a proven track record.' },
          { marker: '3.3', text: 'Be committed to working on local or global projects with the community.' },
          { marker: '3.4', text: 'Reside in, or be closely connected to, the hub’s location.' },
          { marker: '3.5', text: 'Uphold and support the diversity of the hub.**' },
        ],
        footnote: '** Diversity includes but is not limited to age, gender, race, colour, religion, disability, sexual orientation, income, education, and political beliefs.',
      },
      {
        paragraphs: ['To ensure diverse and inclusive hubs, all hubs must:'],
        items: [
          { marker: '4.1', text: 'Represent various stakeholder groups and professional backgrounds (no more than 3 members from the same organization).' },
          { marker: '4.2', text: 'Aim for gender balance (no more than 60% of one gender).' },
          { marker: '4.3', text: 'Avoid conflicts of interest by not selecting direct family relatives or partners of existing members.' },
          { marker: '4.4', text: 'Maintain a minimum of 20 members after 12 months of operation.' },
          { marker: '4.5', text: 'Not exceed 50 members.***' },
        ],
        footnote: '*** If exceeded, a second hub may be opened in the same area based on geographic boundaries. Global Shapers Headquarters oversees the opening of new hubs.',
      },
      {
        paragraphs: ['If hubs do not uphold these principles, Global Shapers Headquarters and the Head of the Community may pursue hub closure.'],
      },
    ],
  },
  {
    id: 'membership-commitments',
    title: 'Membership Commitments',
    blocks: [
      {
        paragraphs: ['By joining the Global Shapers Community, members agree to:'],
        items: [
          { marker: '5.1', text: 'Uphold the purpose and principles of the community.' },
          { marker: '5.2', text: 'Demonstrate respectful and responsible behavior.' },
          { marker: '5.3', text: 'Volunteer their time, energy, and ideas for positive social impact.' },
          { marker: '5.4', text: 'Participate in at least one hub project and/or leadership role annually.' },
          { marker: '5.5', text: 'Attend at least 60% of hub meetings or relevant activities each year.' },
          { marker: '5.6', text: 'Transition to Alumni status when eligible (see Section 6).' },
          { marker: '5.7', text: 'Step down or inform the hub if unable to meet commitments or if a conflict of interest arises.' },
          { marker: '5.8', text: 'Request a temporary pause in membership (maximum six months), if needed and approved by the Curatorship.' },
        ],
      },
    ],
  },
  {
    id: 'alumni-network',
    title: 'Alumni Network',
    blocks: [
      {
        items: [
          {
            marker: '6.1', text: 'Members transition to the Alumni network when they:',
            subItems: ['Reach the age of 30,*', 'Have been active in the community for 5 or more years.**'],
          },
          { marker: '6.2', text: 'Alumni remain connected through TopLink, the Forum’s digital events, and specific Alumni activities.' },
          { marker: '6.3', text: 'Alumni can serve as mentors, share best practices, and support younger members.' },
          { marker: '6.4', text: 'Alumni may take leadership roles in the Global Shapers Council or serve as Regional Champions.' },
        ],
        footnote: '* For those who joined before July 1, 2020, the age limit is extended to 33.\n** Members who reach 5 years of membership before age 30 may retain full status until the age limit. They may opt to graduate earlier by notifying the Curator.',
      },
    ],
  },
  {
    id: 'responsible-behaviour',
    title: 'Responsible Behaviour and Code of Conduct',
    blocks: [
      {
        items: [
          { marker: '7.1', text: 'Global Shapers follow the World Economic Forum’s Code of Conduct, including policies on Respectful Behavior and Integrity Reporting.' },
          { marker: '7.2', text: 'Members are expected to embody the values of Passion, Integrity, Service, Cooperation, and Commitment.' },
          { marker: '7.3', text: 'Members must use digital platforms responsibly, act ethically, and uphold the community’s non-partisan and legal standards.' },
        ],
      },
      {
        paragraphs: ['Unacceptable behaviors include:'],
        items: [
          { text: 'Harassment, intimidation, or discrimination of any kind.' },
          { text: 'Spreading malicious rumors or gossip.' },
          { text: 'Sexual misconduct or unwanted advances.' },
          { text: 'Abuse of power, threats, or retaliation.' },
          { text: 'Online bullying or irresponsible use of social media.' },
        ],
      },
      {
        paragraphs: ['If misconduct occurs:'],
        items: [
          { text: 'The member may face cancellation of membership by the hub or Global Shapers Headquarters.' },
          { text: 'Violations should be reported to globalshapers@weforum.org.' },
          { text: 'Retaliation against reporters is prohibited and may result in immediate expulsion.' },
          { text: 'All parties’ privacy must be respected.' },
        ],
      },
    ],
  },
  {
    id: 'global-governance',
    title: 'Global Governance',
    blocks: [
      {
        items: [
          { marker: '8.1', text: 'A Foundation Board governs the Global Shapers Community.' },
          { marker: '8.2', text: 'The Board includes representatives from the community, the Forum, and partners.' },
          { marker: '8.3', text: 'The Global Shapers Headquarters manages strategy, hub support, events, TopLink, and impact monitoring.' },
          { marker: '8.4', text: 'The Head of the Global Shapers Community holds the authority to make membership and hub-related decisions.' },
          { marker: '8.5', text: 'The Advisory Council and Regional Community Champions provide local support and uphold Charter values.' },
        ],
        footnote: '* If governance leaders do not uphold the Charter, members may report to Headquarters.',
      },
    ],
  },
  {
    id: 'hub-governance',
    title: 'Hub Governance',
    blocks: [
      {
        items: [
          { marker: '9.1', text: 'Each hub is self-governed under the Charter with autonomy to create local guidelines.' },
          { marker: '9.2', text: 'Monthly meetings and at least one impactful local project are required annually.' },
          { marker: '9.3', text: 'Hubs are led by a Curatorship team (Curator, Vice Curator, and Impact Officer) elected annually (July 1–June 30).' },
          { marker: '9.4', text: 'Elections must include at least two candidates for Curator, and members vote by majority.' },
          { marker: '9.5', text: 'Each leader may serve up to two non-consecutive terms.' },
        ],
        footnote: '* If elections are not conducted in good faith, the results may be rejected and a new election required.',
      },
    ],
  },
  {
    id: 'hub-resolution-mechanism',
    title: 'Hub Resolution Mechanism',
    blocks: [
      {
        items: [
          { marker: '10.1', text: 'Each hub must establish a fair and confidential conflict resolution process.' },
          { marker: '10.2', text: 'Curators should facilitate open discussions to resolve disputes.' },
          { marker: '10.3', text: 'If consensus is not reached, members may vote or bring in a neutral mediator.' },
        ],
        footnote: '* If conflicts remain unresolved, members should contact their Community Champion or Headquarters.',
      },
    ],
  },
  {
    id: 'hub-opening-and-closure',
    title: 'Hub Opening and Closure',
    blocks: [
      {
        items: [
          { marker: '11.1', text: 'Only Global Shapers Headquarters can open or close hubs.' },
          { marker: '11.2', text: 'New hubs are launched with a Founding Curator and 5-member founding team.' },
          { marker: '11.3', text: 'Founding Curators serve one year and transition to honorary/advisory roles.' },
          { marker: '11.4', text: 'Hubs may request closure by emailing globalshapers@weforum.org.' },
          { marker: '11.5', text: 'Headquarters may close hubs due to inactivity, internal conflict, or Charter violations.' },
          { marker: '11.6', text: 'Closures typically occur in April following elections.' },
        ],
      },
    ],
  },
  {
    id: 'hub-partnerships',
    title: 'Hub Partnerships',
    blocks: [
      {
        items: [
          { marker: '12.1', text: 'Hubs may engage in financial or in-kind partnerships that comply with local laws and preserve non-profit status.' },
          { marker: '12.2', text: 'All income must be reinvested into hub activities and operations.' },
          { marker: '12.3', text: 'Hubs may introduce membership fees (non-exclusionary).' },
          { marker: '12.4', text: 'Use of the Global Shapers Community name or logo requires written approval from Headquarters.' },
          { marker: '12.5', text: 'Hubs must accurately represent themselves and avoid conflicts of interest.' },
        ],
      },
    ],
  },
  {
    id: 'cancellation-of-membership',
    title: 'Cancellation of Membership',
    blocks: [
      {
        items: [
          {
            marker: '13.1', text: 'Membership can be cancelled at the hub level if commitments are not met.',
            subItems: [
              'Members must be informed and given a 2-month grace period to correct course.',
              'Members may appeal the decision locally.',
            ],
          },
          {
            marker: '13.2', text: 'Global Shapers Headquarters may cancel membership immediately and without notice for:',
            subItems: [
              'Violation of Charter principles.',
              'Breach of the Forum’s Code of Conduct.',
              'Being under investigation for financial or ethical misconduct.',
              'Final decisions are not subject to appeal.',
            ],
          },
        ],
      },
    ],
  },
];
