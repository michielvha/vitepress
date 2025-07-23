export default {
  head: [
    ['link', { rel: 'icon', href: '/icons/favicon.ico' }]
  ],
  title: "edgeforge",
  description: "Innovating at the Edge",
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: 'home', link: '/' },
      { text: 'about us', link: '/aboutus/' },
      {
        text: 'docs',
        items: [
          { text: 'introduction', link: '/docs/' },
          { text: 'blog', link: '/blog/' },
        ]
      }
    ],
    sidebar: [
      {
        text: 'edgeforge',
        items: [
          { text: 'Introduction', link: '/docs/' },
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