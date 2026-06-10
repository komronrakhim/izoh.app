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
  <header className="grid justify-items-center gap-2 pb-4 pt-0 text-center">
    <Avatar
      alt={organizationName}
      className="size-16 rounded-[22px] ring-1 ring-foreground/[0.06]"
      imageClassName="object-cover"
      initialsClassName="ios-title-3"
      name={organizationName}
      seed={avatarSeed}
      src={logoUrl}
    />
    <div className="grid min-w-0 gap-0.5">
      <p className="ios-headline max-w-[260px] truncate font-semibold text-foreground">
        {organizationName}
      </p>
      {qrContext ? (
        <p className="ios-caption-1 max-w-[260px] truncate font-medium text-muted">{qrContext}</p>
      ) : null}
    </div>
  </header>
);
