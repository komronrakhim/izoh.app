import { Avatar } from "~/common/components";

type WizardHeaderProps = {
  avatarSeed: string;
  logoUrl?: string;
  organizationName: string;
  qrContext?: string;
};

export const WizardHeader = ({
  avatarSeed,
  logoUrl,
  organizationName,
  qrContext
}: WizardHeaderProps) => (
  <header className="grid justify-items-center gap-3 pb-3 text-center">
    <Avatar
      alt={organizationName}
      className="size-24 rounded-full ring-1 ring-foreground/[0.06] shadow-[0_16px_36px_rgba(15,23,42,0.08)] dark:shadow-none"
      imageClassName="object-cover"
      initialsClassName="ios-large-title"
      name={organizationName}
      seed={avatarSeed}
      src={logoUrl}
    />
    <div className="grid min-w-0 gap-1">
      <p className="ios-title-3 max-w-[300px] truncate font-semibold tracking-normal text-foreground">
        {organizationName}
      </p>
      {qrContext ? (
        <p className="ios-caption-1 max-w-[260px] truncate font-medium text-muted">{qrContext}</p>
      ) : null}
    </div>
  </header>
);
