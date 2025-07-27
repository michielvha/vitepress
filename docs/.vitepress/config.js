export default {
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico', type: 'image/x-icon' }],
    ['link', { rel: 'icon', href: '/favicon.ico', type: 'image/png' }],
    ['link', { rel: 'apple-touch-icon', href: '/logo.png' }]
  ],
  title: "edgeforge",
  description: "Innovating at the Edge",
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: 'home', link: '/' },
      { text: 'about', link: '/about/' },
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
          {
            text: 'aws', link: '/blog/intro/aws.md',
            items: [
              { text: 'EKS - Carrier Grade NAT overlay', link: '/blog/cgnat-overlay-with-eks' },
            ]
          },
          {
            text: 'devops', link: '/blog/intro/devops.md',
            items: [
              { text: 'automate versioning with GitVersion', link: '/blog/gitversion.md' },
            ]
          }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/edgeforge-labs' }
    ]
  }
}