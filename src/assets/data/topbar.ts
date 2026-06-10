import type { AppType, NotificationType } from '@/types/data'

import bitbucketImg from '@/assets/images/brands/bitbucket.svg'
import dribbleImg from '@/assets/images/brands/dribbble.svg'
import dropboxImg from '@/assets/images/brands/dropbox.svg'
import githubImg from '@/assets/images/brands/github.svg'
import slackImg from '@/assets/images/brands/slack.svg'
import avatar1 from '@/assets/images/users/avatar-1.jpg'
import avatar3 from '@/assets/images/users/avatar-3.jpg'
import avatar5 from '@/assets/images/users/avatar-5.jpg'

export const appsData: AppType[] = [
  {
    image: githubImg,
    name: 'Github',
    handle: '@Rasket',
  },
  {
    image: bitbucketImg,
    name: 'Bitbucket',
    handle: '@Rasket',
  },
  {
    image: dribbleImg,
    name: 'Dribble',
    handle: '@username',
  },
  {
    image: dropboxImg,
    name: 'Dropbox',
    handle: '@username',
  },
  {
    image: slackImg,
    name: 'Slack',
    handle: '@Rasket',
  },
]

export const notificationsData: NotificationType[] = [
  {
    from: 'Josephine Thompson',
    content: 'commented on admin panel "Wow 😍! this admin looks good and awesome design"',
    icon: avatar1,
  },
  {
    from: 'Donoghue Susan',
    content: 'Hi, How are you? What about our next meeting',
  },
  {
    from: 'Jacob Gines',
    content: "Answered to your comment on the cash flow forecast's graph 🔔.",
    icon: avatar3,
  },
  {
    from: 'Shawn Bunch',
    content: 'Commented on Admin',
    icon: avatar5,
  },
  {
    from: 'Vanessa R. Davis',
    content: 'Delivery processing your order is being shipped',
  },
]
