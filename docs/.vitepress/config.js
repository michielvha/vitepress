export default {
  head: [
    ['link', { rel: 'icon', href: '/icons/favicon.ico' }]
  ],
  title: "edgeforge",
  description: "Innovating at the Edge",
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'General', link: '/docs/' },
      { text: 'About us', link: '/aboutus/' },
      {
        text: 'Projects',
        items: [
          { text: 'edge-cloud', link: '/edge-cloud/' },
          { text: 'edgectl', link: '/item-2' },
        ]
      }
    ],
    sidebar: [
      {
        text: 'edgeforge',
        items: [
          { text: 'Introduction', link: '/docs/' },
          { text: 'Getting Started', link: '/docs/getting-started' },
        ]
      },
      {
        text: 'edgectl',
        items: [
          { text: 'Introduction', link: '/edgectl' },
          { text: 'Getting Started', link: '/edgectl/getting-started' },
        ]
      },
      {
        text: 'edge-cloud',
        items: [
          { text: 'Introduction', link: '/edge-cloud' },
          { text: 'Getting Started', link: '/edgectl/getting-started' },
        ]
      },
      {
        text: 'blog',
        items: [
          { text: 'CGNAT overlay with EKS', link: '/blog/cgnat-overlay-with-eks' },
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/edgeforge-labs' }
    ]
  }
}