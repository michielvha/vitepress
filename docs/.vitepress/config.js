export default {
  ignoreDeadLinks: true,
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
              { text: 'EKS - Carrier Grade NAT overlay', link: '/blog/aws/cgnat-overlay-with-eks' },
              { text: 'Crossplane with EKS Pod Identity', link: '/blog/aws/crossplane-with-eks-pod-identity' },
            ]
          },
          {
            text: 'azure', link: '/blog/intro/azure.md',
            items: [
              { text: 'Azure AI Proxy', link: '/blog/azure-ai-proxy.md' },
            ]
          },
          {
            text: 'devops', link: '/blog/intro/devops.md',
            items: [
              { text: 'automate versioning with GitVersion', link: '/blog/gitversion.md' },
            ]
          },
          // {
          //   text: 'kubernetes', link: '/blog/intro/kubernetes.md',
          //   items: [
          //     { text: 'Troubleshooting Kubernetes', link: '/blog/troubleshooting-kubernetes.md' },
          //   ]
          // }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/edgeforge-labs' }
    ]
  }
}