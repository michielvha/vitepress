export default {
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],
  title: "edgeforge",
  description: "A VitePres documentation site",
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/docs/' },
      {
        text: 'Dropdown Menu',
        items: [
          { text: 'Item A', link: '/item-1' },
          { text: 'Item B', link: '/item-2' },
          { text: 'Item C', link: '/item-3' }
        ]
      }
    ],
    sidebar: [
      {
        text: 'Introduction',
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
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/edgeforge-labs' }
    ]
  }
}