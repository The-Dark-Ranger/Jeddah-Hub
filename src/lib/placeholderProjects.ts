export interface PlaceholderProject {
  id: string;
  title: string;
  titleAr?: string;
  description: string;
  descriptionAr?: string;
  category?: string;
  status?: string;
  stat?: string;
  problem?: string;
  objective?: string;
  impact?: string;
  impactAreas?: string[];
  /** Cover image set by the curator — shown on the card and as the detail hero. */
  imageUrl?: string;
  images?: string[];
  members?: { userId: string; role?: string }[];
  color?: string;
}

export const PLACEHOLDER_PROJECTS: PlaceholderProject[] = [
  {
    id: 'tech-j-shore',
    title: 'Tech J Shore',
    category: 'Education',
    status: 'active',
    stat: 'Reskilling for the Future',
    description: 'Workshops, panels, and hands-on activities that bring together youth, industry experts, and innovators to build future-ready digital skills.',
    problem: 'Young people in Jeddah face limited exposure to emerging technologies and digital skills, which restricts their ability to compete in a rapidly evolving global economy. Opportunities to learn, experiment, and connect with the tech ecosystem remain scarce.',
    objective: 'Tech J Shore introduces workshops, panels, and hands-on activities that bring together youth, industry experts, and innovators. By creating accessible entry points into various fields the program equips participants with future-ready skills while building a collaborative tech community.',
    impact: 'The initiative has inspired youth to explore technology-driven careers, increased awareness of digital opportunities, and strengthened Jeddah\'s positioning as a hub for innovation and talent development.',
    impactAreas: ['Education', 'Technology', 'Youth', 'Economy'],
  },
  {
    id: 'collect-it',
    title: 'Collect It!',
    category: 'Sustainability',
    status: 'active',
    stat: 'Protect the Planet',
    description: 'A structured school recycling program using awareness sessions, labeled bins, and a reward-based system to build sustainable habits among students.',
    problem: 'Schools generate large amounts of plastic and paper waste but lack structured systems to promote recycling and build sustainable habits among students.',
    objective: 'Collect It introduces a structured recycling program in schools through awareness sessions, labeled recycling bins, a reward-based system, and partnerships with recycling companies like Naqaa.',
    impact: 'Engaged students in structured recycling, reduced landfill waste, and proved scalability through a successful school pilot with Naqaa.',
    impactAreas: ['Sustainability', 'Education', 'Community', 'Environment'],
  },
  {
    id: 'voices-unbound',
    title: 'Voices Unbound',
    category: 'Community',
    status: 'active',
    stat: 'Deliver Basic Needs',
    description: 'Safe spaces for youth to share ideas through storytelling, discussions, and creative expression — amplifying diverse voices across Saudi Arabia.',
    problem: 'Many young people in Saudi Arabia feel their perspectives are overlooked in public dialogue, with few platforms available to express their views freely and contribute to social conversations.',
    objective: 'Voices Unbound creates safe spaces for youth to share ideas through storytelling, discussions, and creative expression. The initiative amplifies diverse voices, encourages open dialogue, and fosters empathy across communities.',
    impact: 'The project has empowered youth to speak up, built confidence in self-expression, and promoted inclusivity. By highlighting young perspectives, it strengthens civic engagement and contributes to a culture of open dialogue.',
    impactAreas: ['Community', 'Wellbeing', 'Youth', 'Education'],
  },
  {
    id: 'eduindustry',
    title: 'EduIndustry',
    category: 'Education',
    status: 'active',
    stat: 'Reskilling for the Future',
    description: 'Bridging the gap between education and industry through workshops, expert lectures, and hands-on internship experiences for high school and university students.',
    problem: 'High school and university students in Jeddah need practical training and entrepreneurship exposure, limiting their preparedness for the job market and future careers.',
    objective: 'EduIndustry bridges the gap by offering workshops on essential market skills, expert lectures on career journeys, and hands-on internship experiences.',
    impact: 'Engaged high school students through workshops and training at UBT and Effat, built partnerships with companies, and equipped youth with skills and market insights to support career readiness.',
    impactAreas: ['Education', 'Economy', 'Youth', 'Entrepreneurship'],
  },
  {
    id: 'nasmat-alamal',
    title: 'Nasmat Alamal',
    category: 'Community',
    status: 'active',
    stat: '10,000+ beneficiaries reached',
    description: 'Community-driven Ramadan and Eid initiatives providing Iftar meals and gifts to underprivileged families and hospitalized children in Jeddah.',
    problem: 'Many underprivileged families and hospitalized children in Jeddah face challenges in celebrating Ramadan and Eid due to financial and health constraints, leaving them without access to meals or festive joy.',
    objective: 'Nasmat Alamal organizes community-driven initiatives during Ramadan and Eid, including Iftar meal distributions for families in need and gift-giving for children in hospitals, with volunteers leading logistics and outreach.',
    impact: 'Over three years, the initiative has reached more than 10,000 beneficiaries, bringing joy during festive seasons and strengthening community bonds through sustained volunteer participation and collective action.',
    impactAreas: ['Community', 'Wellbeing', 'Youth'],
  },
];

export const CATEGORY_COLORS: Record<string, string> = {
  Education:      '#0f5a9f',
  Sustainability: '#10b981',
  Wellbeing:      '#7c3aed',
  Economy:        '#f59e0b',
  Community:      '#ef4444',
  Environment:    '#059669',
  Health:         '#7c3aed',
  Technology:     '#0891b2',
  'Arts & Culture': '#d97706',
  Default:        '#0891b2',
};
