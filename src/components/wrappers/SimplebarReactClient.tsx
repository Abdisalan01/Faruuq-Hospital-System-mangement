import type { ChildrenType } from '@/types/component-props'
import type SimpleBarCore from 'simplebar-core'
import SimpleBar, { type Props as SimpleBarProps } from 'simplebar-react'

type SimplebarReactClientProps = SimpleBarProps &
  ChildrenType & {
    ref?: React.Ref<SimpleBarCore | null>
  }

const SimplebarReactClient = ({ children, ...options }: SimplebarReactClientProps) => {
  return <SimpleBar {...options}>{children}</SimpleBar>
}

export default SimplebarReactClient
