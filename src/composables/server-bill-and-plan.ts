import { t } from '@/i18n';
import dayjs from 'dayjs';
import config from '@/config';
import validate from '@/utils/validate';
import * as dateUtils from '@/utils/date';
import billing from '@/utils/billing';

/**
 * 根据服务器信息计算账单和套餐数据
 * @param {Object} info 服务器信息
 * @returns {Object} 账单和套餐数据
 */
export function getBillAndPlanByServer(info) {
  const obj = {
    billing: null,
    remainingTime: null,
    bandwidth: null,
    traffic: null,
  };
  if (info?.PublicNote) {
    const {
      billingDataMod,
      planDataMod,
    } = info.PublicNote;
    // 默认1个月
    let months = 1;
    // 套餐资费
    let cycleLabel;
    if (validate.isSet(billingDataMod?.cycle)) {
      const cycleStr = String(billingDataMod.cycle).trim();
      months = billing.getCycleMonths(cycleStr);
      cycleLabel = billing.getCycleLabel(cycleStr);
    }
    if (validate.isSet(billingDataMod?.amount)) {
      let isFree = false;
      let amountValue = billingDataMod.amount;
      let label;
      if (billingDataMod.amount.toString() === '-1') {
        amountValue = t('按量');
        label = cycleLabel ? t('每{{cycle}}', { cycle: cycleLabel }) : '';
      } else if (billingDataMod.amount.toString() === '0') {
        amountValue = config.aobobo.freeAmount || t('免费');
        isFree = true;
      } else {
        label = cycleLabel ? t('{{cycle}}付', { cycle: cycleLabel }) : '';
      }
      obj.billing = {
        label,
        value: amountValue,
        cycleLabel,
        months,
        isFree,
      };
    }
    // 剩余时间
    if (validate.isSet(billingDataMod?.endDate)) {
      const {
        endDate,
        autoRenewal,
      } = billingDataMod;
      const nowTime = new Date().getTime();
      const endTime = dayjs(endDate).valueOf();
      if (billing.isInfinityEndDate(endDate)) {
        obj.remainingTime = {
          label: t('剩余'),
          value: config.aobobo.infinityCycle || t('长期有效'),
          type: 'infinity',
        };
      } else if (billing.isAutoRenewalEnabled(autoRenewal)) {
        // 自动续费时间计算，cycleType 为 1 时为月，为 12 时为年
        // 判断endDate是否超过当前时间，超过则显示剩余时间
        if (endTime > nowTime) {
          const diff = dayjs(endTime).diff(dayjs(), 'day') + 1;
          obj.remainingTime = {
            label: t('剩余'),
            value: t('{{days}}天', { days: diff }),
            value2: diff,
            type: 'autoRenewal-endTime',
          };
        } else {
          // endDate如果早于当前时间，按照cycleType计算出超过当前时间的结束时间
          const nextTime = dateUtils.getNextCycleTime(endTime, months, nowTime);
          const diff = dayjs(nextTime).diff(dayjs(), 'day') + 1;
          obj.remainingTime = {
            label: t('剩余'),
            value: t('{{days}}天', { days: diff }),
            value2: diff,
            type: 'autoRenewal-nextTime',
          };
        }
      } else if (endTime > nowTime) {
        const diff = dayjs(endTime).diff(dayjs(), 'day') + 1;
        obj.remainingTime = {
          label: t('剩余'),
          value: t('{{days}}天', { days: diff }),
          value2: diff,
          type: 'endTime',
        };
      } else {
        obj.remainingTime = {
          label: t('剩余'),
          value: t('已过期'),
          type: 'expired',
        };
      }
    }
    // 带宽、流量
    if (planDataMod) {
      if (planDataMod.bandwidth) {
        obj.bandwidth = {
          label: t('带宽'),
          value: planDataMod.bandwidth,
        };
      }
      if (planDataMod.trafficVol) {
        let trafficTypeLabel = t('双向');
        if (planDataMod.trafficType === '1') {
          trafficTypeLabel = t('单向出');
        } else if (planDataMod.trafficType === '3') {
          trafficTypeLabel = t('单向取最大');
        }
        obj.traffic = {
          label: t('{{type}}流量', { type: trafficTypeLabel }),
          value: planDataMod.trafficVol,
        };
      }
    }
  }
  return obj;
}

export default getBillAndPlanByServer;
